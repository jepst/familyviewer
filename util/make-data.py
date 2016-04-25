#!/usr/bin/python3
import jgedcom
import json
from dateutil import parser
import datetime
import re
import argparse

def java_hashcode(s):
    # https://gist.github.com/hanleybrand/5224673
    h = 0
    for c in s:
        h = (31 * h + ord(c)) & 0xFFFFFFFF
    return ((h + 0x80000000) & 0xFFFFFFFF) - 0x80000000

def first(vals, default=None):
    if len(vals) == 0:
        if default is None:
            raise ValueError("Unexpected missing value")
        return default
    return vals[0]

def shorten_place_name(val):
    return val.split(",")[0]

def sort_cites(lst):
    lst.sort(key=lambda x: x[0])
    return lst

def uniq(lst):
    return list(set(lst))

def slow_uniq(lst):
    res = []
    for each in lst:
        if each not in res:
            res.append(each)
    return res

def concat_text(rest):
    for [tag, val] in rest:
        if tag not in ['CONC','CONT']:
            raise ValueError("Text field shouldn't contain %s tag" % tag)
    return [line if tag == 'CONC' else "\n"+line for [tag, line] in rest]

def clean_note(n):
    rest = concat_text(n[1])
    return "".join(n[0]+rest)

def shorten_date(val):
    if not val:
        return val
    v = val.split()[-1]
    if len(v) == 4:
        return v
    else:
        return ""

def clean_cites(cites):
    def clean_cite(cite):
        uninteresting = ['URL:  http://www.findagrave.com/cgi-...|',
            'Occupation:  View on Image| ', 
            'Age: Occupation: Nearest Relative: Height/Build: Color of Eyes/Hair: Signature:   View image| ',
            'View Neighbors:  View Neighbors|',
            '-Scraped-','Neighbors:  View others on page| ',
            'Map of Home:  View Map| ',
            'Occupation:  View on Image| ',
            'Neighbors:  View others on page| ',
            'Cannot read/write: Blind: Deaf and Dumb: Otherwise disabled: Idiotic or insane:   View image| ',
            'URL:  This record is not from Ancestry and will open in a new window. You may need to search for the record when the web page opens. For more information on web records, click here  . You will need to log-in or register  to save this record to your tree.|']
        for each in uninteresting:
            cite = cite.replace(each,'')

        if cite.endswith('|'):
            cite=cite[:-1]
        while cite.startswith(' '):
            cite=cite[1:]
        # Compensate for Ancestry broken newline handling
        return cite.replace('| ','\n').replace('  ', ' ')
    res = []
    for [title, first, rest] in cites:
        if len(title) != 1 or len(first) > 1:
            raise Exception("Got unexpeced count of titles per citation")
        rest = concat_text(rest)
        res.append([title[0], clean_cite("".join(first[0:1]+rest))])
    # TODO: sort citation in order, provide x-ref with Ancestry page ID
    return res

def dtparse(s):
    return parser.parse(s, default=datetime.datetime.min)

def sort_name_index(name_index):
    def sorter(x):
        name = x["name"]
        parts = name.split(" ")

        surnames = []
        nonsurnames = []
        insurname = False
        for part in parts:
            if part.startswith("/"):
                insurname = True

            if insurname:
                surnames.append(part.replace("/",""))
            else:
                nonsurnames.append(part.replace("/",""))

            if part.endswith("/") and insurname:
                insurname = False

        return surnames + nonsurnames

    name_index.sort(key=sorter)

def sort_chrono(lst):
    def clean(x):
        if x.startswith("abt ") or x.startswith("ABT "):
            x=x[4:]
        if x.startswith("Abt. "):
            x=x[5:]
        while True:
            rem = re.match('^(\d\d\d\d)[- ]\d\d\d\d',x)
            if rem:
                x=rem.groups()[0]
            else:
                break
        return x
    def sortkey(x):
        if x[0] == "":
            if x[-1] == "B":
                return datetime.datetime(datetime.MINYEAR,1,1)
            elif x[-1] == "D":
                return datetime.datetime(datetime.MAXYEAR,1,1)
            else:
                raise ValueError("Missing date where expected: %s" % x)
        return dtparse(clean(x[0]))
    for n in lst:
        try:
            dtparse(clean(n[0]))
        except Exception as e:
            raise Exception("Can't parse %s as date because %s" %
                (clean(n[0]),str(e)))
    lst.sort(key=sortkey)
    return lst


def sort_birthdays(birthdays):
    birthdays.sort(key=lambda x: dtparse(x[1]))

def clean_birthday_date(dat):
    v = dat.split()
    if len(v) != 3:
        return ""
    try:
        vi = int(v[0])
    except ValueError:
        return ""
    if vi < 1 or vi > 31:
        return ""
    if v[1].lower() not in ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]:
        print("Possibly malformed date: %s" % dat)
        return ""
    return "%s %s" % (str(vi), v[1].title())

def real_id(indv):
    return first(indv.get_attr('EMAIL'), first(indv.pointer()))

def mrk(lst, mrk):
    for i in lst:
        i.append(mrk)
    return lst

def exclude(val, lst):
    while val in lst:
        lst.remove(val)
    return lst

def main():

    parser = argparse.ArgumentParser(description="Generate familyviewer2 data files from a gedcom")
    parser.add_argument("--gedcom", help="Source gedcom file", default="../../genealogy/Family Tree.ged")
    parser.add_argument("--citations", help="Include citation transcriptions", action="store_true")
    parser.add_argument("--note", help="Include notes on individuals from gedcom", action="store_true")
    parser.add_argument("--pretty", help="Pretty print output", action="store_true")
    parser.add_argument("--name", help="Get just one person")
    parser.add_argument("--partition-details", type=int, help="Optionally split the details file into several smaller files", default=1)
    args = parser.parse_args()

    input_filename=args.gedcom # input GEDCOM file
    json_style = {"sort_keys":True, "indent":2, "separators":(',', ': ')} if args.pretty else {}
    structure_outputfile = "../data/structure.json" # structural and relationship data
    details_outputfile = "../data/details%s.json" # life event data
    config_outputfile = "../data/config.json"
    birthdays_outputfile = "../data/birthdays.json"

    gedcom = jgedcom.Gedcom(input_filename)

    structure = []
    details = {}
    birthdays = []
    initial_person = None

    id_mapping = {}
    def remap(n):
        return [id_mapping[x] for x in n]

    search_set = gedcom.all().tag('INDI')
    if args.name:
        search_set = search_set.attr_equal('NAME',args.name)

    for individual in search_set.foreach():
        id_mapping[first(individual.pointer())] = real_id(individual)

    for individual in search_set.foreach():

        person = {
            "id": first(remap(individual.pointer())),
            "name": (first(individual.get_attr('NAME'))),
            "sex": first(individual.get_attr('SEX'), "z").lower(),
            "parents": remap(individual.deref('FAMC').get_attr("HUSB","WIFE","SPOU","FATH","MOTH")),

            # we take both those listed as spouses, as well as all those listed as coparents, but not spouses
            # Unexpectedly, Ancestry allows people to share children even if they are  not listed as spouses
            # In the Gedcom, there were example of a child having two FAMC references: one for the mother
            # and one for the father. Not sure if that's valid, but in either case we now deal with it:
            # the triple deref below collects the individual's children's parents.
            "spouses": remap(exclude(first(individual.pointer()), uniq(
                individual.deref('FAMS').get_attr("HUSB","WIFE","SPOU","FATH","MOTH")+
                individual.deref('FAMS').deref("CHIL").deref('FAMC').get_attr("HUSB","WIFE","SPOU","FATH","MOTH") ) )),
            "children": remap(individual.deref('FAMS').get_attr("CHIL")),
            "birth": first(individual.sub('BIRT').foreach_tuple(lambda g: 
                shorten_date(first(g.get_attr('DATE'), "")),lambda g: shorten_place_name(first(g.get_attr('PLAC'), "")) ),["",""]),
            "death": first(individual.sub('DEAT').foreach_tuple(lambda g: 
                shorten_date(first(g.get_attr('DATE'), "")),lambda g: shorten_place_name(first(g.get_attr('PLAC'), "")) ), ["",""]),
        }
        if initial_person is None:
            initial_person = person['id']

        detail = {
            "id": first(remap(individual.pointer())),
            "names": [name for name in individual.get_attr('NAME')],
            "note": clean_note(individual.tuple(
                lambda g: g.get_attr('NOTE'), 
                lambda g: g.sub('NOTE').collect_child_values())) if args.note else "",
            "cites": sort_cites(clean_cites(slow_uniq(individual.all().sub('SOUR').foreach_tuple( 
                lambda g:g.deref_value().get_attr('TITL'), 
                lambda g:g.sub('DATA').get_attr('TEXT'), 
                lambda g:g.sub('DATA').sub('TEXT').collect_child_values())))) if args.citations else [],
            "events":sort_chrono(
                #birth
                mrk(individual.sub('BIRT').foreach_tuple(lambda g: 
                    first(g.get_attr('DATE'), ""),lambda g: first(g.get_attr('PLAC'), ""))[0:1],"B")+

                #death
                mrk(individual.sub('DEAT').foreach_tuple(lambda g: 
                    first(g.get_attr('DATE'), ""),lambda g: first(g.get_attr('PLAC'), ""))[0:1],"D")+

                #travel
                mrk(individual.sub('EVEN').attr_equal('TYPE','Arrival').attr_exclude('PLAC','').
                    attr_exclude('DATE','').
                    foreach_tuple(
                        lambda g:first(g.get_attr('DATE'),""),
                        lambda g:first(g.get_attr('PLAC'),"")),'A')+
                mrk(individual.sub('EVEN').attr_equal('TYPE','Departure').attr_exclude('PLAC','').
                    attr_exclude('DATE','').
                    foreach_tuple(
                        lambda g:first(g.get_attr('DATE'),""),
                        lambda g:first(g.get_attr('PLAC'),"")),'L')+

                #marriage
                mrk(individual.deref('FAMS').require_sub_attr('MARR','DATE').foreach_tuple(
                    lambda g:first(g.sub('MARR').get_attr('DATE')),
                    lambda g:first(remap(exclude(first(individual.pointer()),g.get_attr("HUSB","WIFE","SPOU","FATH","MOTH")))),
                    lambda g:first(g.sub('MARR').get_attr('PLAC'),"")),'M')+

                #divorce
                mrk(individual.deref('FAMS').require_sub_attr('DIV','DATE').foreach_tuple(
                    lambda g:first(g.sub('DIV').get_attr('DATE')),
                    lambda g:first(remap(exclude(first(individual.pointer()),g.get_attr("HUSB","WIFE","SPOU","FATH","MOTH")))),
                    lambda g:first(g.sub('DIV').get_attr('PLAC'),"")),'V')+

                # residences 
                mrk(individual.sub('RESI').attr_exclude('DATE','').attr_exclude('PLAC','').
                    foreach_tuple(lambda g:first(g.get_attr('DATE')), 
                    lambda g:first(g.get_attr('PLAC'))),'R')
                ),
        }
        birthday = [
            first(remap(individual.pointer())),
            clean_birthday_date(first(individual.sub('BIRT').sub('DATE').value(), ""))
        ]

        if birthday[1] and not first(individual.sub('DEAT').sub('DATE').value(),""):
            birthdays.append(birthday)
        structure.append(person)
        details[detail["id"]] = detail
        #print(json.dumps(person, sort_keys=True, indent=2, separators=(',', ': ')))
        #print(json.dumps(detail, sort_keys=True, indent=2, separators=(',', ': ')))

    # partition
    partitions={}
    for detailid, detaildata in details.items():
        partitionid = abs(java_hashcode(detailid)) % args.partition_details
        partition = partitions.setdefault(partitionid, {})
        partition[detailid] = detaildata

    # structure file
    sort_name_index(structure)
    with open(structure_outputfile,"w") as f:
        json.dump(structure, f, **json_style)

    # birthdays file
    sort_birthdays(birthdays)
    with open(birthdays_outputfile, "w") as f:
        json.dump(birthdays, f, **json_style)

    # details files
    for partitionid, partition in partitions.items():
        with open(details_outputfile % partitionid,"w") as f:
            json.dump(partition, f, **json_style)

    # config file
    try:
        with open(config_outputfile, "r") as f:
            config = json.load(f);
    except:
        config = {}
    config["initial_person"] = initial_person
    config["partition_details"] = args.partition_details
    config["created_date"] = datetime.datetime.now().strftime("%d %b %Y %H:%M:%S")
    with open(config_outputfile, "w") as f:
        json.dump(config, f, **json_style);

if __name__ == "__main__":
    main()
