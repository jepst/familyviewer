#!/usr/bin/env python

"""
A parser and query system for GEDCOM files (a common format for storing family trees).

The format is documented here: http://homepages.rootsweb.ancestry.com/~pmcbride/gedcom/55gctoc.htm

This code was originally based on the module by Madeleine Ball (mpball@gmail.com) at
https://github.com/madprime/python-gedcom which was in turn based on one from Daniel Zappala.
"""

import re

__author__ = "Jeff Epstein"
__copyright__ = "Copyright 2016, Jeff Epstein"
__license__ = "GPL"
__version__ = "1.0.0"
__status__ = "Production"

class Gedcom(object):
    """
    A simple wrapper for querying GEDCOMs. This makes it easy to traverse
    hierarchical layered tags, but it does not attempt to hide differences
    in various GEDCOM formats (e.g. whether an individual's name is expressed
    as a value of the NAME tag, or as separate first name and last name
    children of the NAME tag), nor does it attempt to encode any domain-specific
    knowledge.

    Some examples:

    g=Gedcom('mytree.ged')

    Get all names for everyone with a given name
        g.all().tag('INDI').attr_equal('NAME','Jeffrey Elias /Epstein/').get_attr('NAME')
    Get mother(s) of same
        g.all().tag('INDI').attr_equal('NAME','Jeffrey Elias /Epstein/').deref('FAMC').tag('FAM').deref('WIFE').get_attr('NAME')
    Get names of all of Jeff's father's children
        g.all().tag('INDI').attr_equal('NAME','Jeffrey Elias /Epstein/').deref('FAMC').tag('FAM').deref('HUSB').deref('FAMS').deref('CHIL').get_attr('NAME')
    Get his gender
        g.all().tag('INDI').attr_equal('NAME','Jeffrey Elias /Epstein/').get_attr('SEX')
    His birthday
        g.all().tag('INDI').attr_equal('NAME','Jeffrey Elias /Epstein/').sub('BIRT').get_attr('DATE')
    His birthday and place
        g.all().tag('INDI').attr_equal('NAME','Jeffrey Elias /Epstein/').sub('BIRT').tuple(lambda g: g.get_attr('DATE'),lambda g: g.get_attr('PLAC'))
    Only primary death
        g.all().tag('INDI').attr_equal('NAME','Morris /Epstein/').sub('DEAT').first().tuple(lambda g: g.get_attr('DATE'),lambda g: g.get_attr('PLAC')
    Extract multiline note
        g.all().tag('INDI').attr_equal('NAME','Morris /Epstein/').first().tuple(lambda g: g.get_attr('NOTE'), lambda g:g.sub('NOTE').get_attr('CONT') )
    Get source transcription of all name citations
        g.all().tag('INDI').attr_equal('NAME','Morris /Epstein/').first().sub('NAME').sub('SOUR').sub('DATA').get_attr('TEXT')
    Get source transcriptions paired with titles
        g.all().tag('INDI').attr_equal('NAME','Morris /Epstein/').first().all().sub('SOUR').foreach_tuple(lambda g:g.deref_value().get_attr('TITL'), lambda g:g.sub('DATA').get_attr('TEXT'), lambda g:g.sub('DATA').require_sub_attr('TEXT','CONC').sub('TEXT').get_attr('CONC'))
    """
    def __init__(self, filename):
        (self.pointer_dict, self.toplevel) = parse(filename)
    def all(self):
        return Selector(self.pointer_dict,self.toplevel['children'])

class Selector(object):
    """
    A helper class for managing subsets of GEDCOM data.
    """
    def __init__(self, ps, recs):
        self.recs = recs
        self.ps = ps

    def value(self):
        return [child['value'] for child in self.recs]

    def foreach(self):
        for v in self.recs:
            yield Selector(self.ps,[v])

    def pointer(self):
        return [child['pointer'] for child in self.recs]

    def deref_value(self):
        return Selector(self.ps, [self.ps[child['value']] for child in self.recs])

    def collect_child_values(self):
        return [[subs['tag'], subs['value']] for child in self.recs if 'children' in child for subs in child['children']]

    def deref(self, name):
        return Selector(self.ps,[self.ps[subs['value']] for child in self.recs if 'children' in child for subs in child['children'] if subs['tag']==name])

    def first(self):
        return Selector(self.ps,[self.recs[0]] if self.recs else [])

    def force_first(self, default=None):
        if len(self.recs) == 0:
            return default
        return self.recs[0]

    def tuple(self, *args):
        return [arg(self) for arg in args]

    def uniq(self):
        print(self.recs)
        return Selector(self.ps, [{'value':i} for i in list(set([child['value'] for child in self.recs]))])

    def foreach_tuple(self, *args):
        return [[arg(Selector(self.ps,[child])) for arg in args] for child in self.recs]

    def attr_cond(self, name, fn):
        return Selector(self.ps,[child for child in self.recs for subs in child['children'] if subs['tag']==name and fn(subs['value'])])

    def attr_equal(self,name, *values):
        return Selector(self.ps,[child for child in self.recs for subs in child['children'] if subs['tag']==name and subs['value'] in values])

    def attr_exclude(self,name, *values):
        return Selector(self.ps,[child for child in self.recs for subs in child['children'] if subs['tag']==name and subs['value'] not in values])

    def require_sub_attr(self,first,second):
        return Selector(self.ps,[child for child in self.recs if 'children' in child for sub in child['children'] if sub['tag']==first
            and 'children' in sub and [t for t in sub['children'] if t['tag']==second]])        

    def require_sub(self):
        return Selector(self.ps,[child for child in self.recs if 'children' in child])

    def get_attr(self, *names):
        return [subs['value'] for child in self.recs for subs in child['children'] if subs['tag'] in names]

    def sub(self, name):
        return Selector(self.ps,[sub for child in self.recs if 'children' in child for sub in child['children'] if sub['tag']==name])

    def all(self):
        return Selector(self.ps,[sub for child in self.recs if 'children' in child for sub in child['children'] ])

    def sub_cond(self, fn):
        return Selector(self.ps,[sub for child in self.recs if 'children' in child for sub in child['children'] if fn(sub['tag'])])

    def tag(self,t):
        return Selector(self.ps,[child for child in self.recs if child['tag'] == t])

def parse(filepath):
    """
    Simply parse the GEDCOM and return its contents as nested Python dicts. Returns
    a tuple: the first object of the tuple is the so-called pointer dictionary, containing
    keys mapping to all GEDCOM objects with a an identifier. The second object of the
    returned tuple is the top-level GEDCOM object, whose children are all objects in the file.
    """

    # This regexp borrowed (stolen) from https://github.com/madprime/python-gedcom
    # by Madeleine Ball (mpball@gmail.com)
    gedcom_line = re.compile(
            '^(0|[1-9]+[0-9]*) ' +
            '(@[^@]+@ |)' +
            '([A-Za-z0-9_]+)' +
            '( [^\n\r]*|)' +
            '(\r|\n)')
    line_num = 1
    pointer_dict = {}
    toplevel = {}
    stack = [toplevel]
    with open(filepath, 'rU') as gedcom_file:
        for line in gedcom_file:
            ret = gedcom_line.match(line)
            if ret:
                line_parts = ret.groups()
            else:
                raise ValueError("Bad gedcom parse at line %s" % line_num)

            level = int(line_parts[0])
            pointer = line_parts[1].rstrip(' ')
            tag = line_parts[2]
            value = line_parts[3].lstrip(' ')

            if level > len(stack) - 1:
                raise ValueError("Bad gedcom level at line %s" % line_num)

            element = {"tag": tag, "value": value}
            if pointer:
                element["pointer"] = pointer
                pointer_dict[pointer] = element

            while len(stack)-1 > level:
                stack.pop()

            parent_elem = stack[-1]
            
            parent_elem.setdefault("children", []).append(element)
            stack.append(element)
            line_num += 1
    return (pointer_dict, toplevel)

