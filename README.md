![](https://cloud.githubusercontent.com/assets/617498/14771795/bf1146d6-0a9d-11e6-8a5a-75d7e002beb4.png)


Family Viewer
=======================
Try the [Live demo](http://jepst.github.io/familyviewer/render.html)

Family viewer is a client-side, JavaScript application for viewing family trees in your web browser. It takes (most) any file in GEDCOM format and displays it in a visually-pleasing, interactive manner in (most) any, reasonably modern web browser.

## Basic usage

* Drag to scroll
* Click on an individual to change focus
* Details about the individual (events, citations, notes, picture) are displayed in their detail window
* Type a name into the search field to locate an individual by name
* Click the `+` and `-` buttons to change font size
* Navigate with keyboard (arrow keys to select immediate relatives, number keys to select a spouse)
* The presence of hidden relatives is indicated with green rows; click to reveal them

## Other features

* Works on desktop and mobile (phone and tablets).
* View pictures attached to individuals. (The script to generate data for this feature is not ready yet.)
* View a "narrative," a chronological family timeline for an ancestor and all their descendants. (The script to generate data for this feature is not ready yet.)
* Supports very large trees. You can break the tree into chunks of arbitrary size which will be downloaded on-demand.
* Birthday calendar. Click on `Help` and then `Birthdays` to show a convenient list of everyone's birthday.
* Also includes a Python GEDCOM parsing library.

## Getting started

Run this to generate the requisite json files in the `data/` directory:

```bash
cd familyviewer/util
./make-data.py --gedcom path/to/your/family.ged --note --citations
```

The optional `--note` and `--citations` flags tell the script to include any NOTE fields and reference transcriptions contained in your GEDCOM. If you include these flags and the relevant data is present, then the given individuals will have a "Citations" and "Note" tab in their detail window.

If your tree is very large, and you want to speed up load time of the page, use the `--partition-details` flag to split the detail data into multiple files, which will be downloaded by the client on demand. Note that for now, only detail data (events, notes, citations) is split.

## Author

The author of this project is [jepst](https://github.com/jepst/).

## License

This program is released under the [GPL](LICENSE).
