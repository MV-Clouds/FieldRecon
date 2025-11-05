## Using PDF.js within the Composer package
This directory contains the PDF.js library, obtained from here: https://mozilla.github.io/pdf.js/
Conga utilizes the PDF.js library in accordance with the Apache 2.0 license included in this directory.

None of the originally provided files from the PDF.js library have been changed for the Composer preview merge use case;
however, several files specific to the preview merge use case have been forked with new names and then modified,
or added as new files.  These are described below.

The /web directory contains several files which have been added to customize the PDF viewer for the Preview Merge use case:
- previewMerge.css: custom css for the preview merge use case
- previewMerge.js: custom javascript for the preview merge use case
- previewMergeViewer.js: a fork of the original viewer.js file, with a few small changes specific to the preview merge use case
- previewMergeViewer.html: a fork of the original viewer.html file, with a few changes specific to the preview merge use case
- composerdocicons: this subdirectory contains several png files for document icons, obtained from the Salesforce Lightning Design System
- Generatingpreview.pdf: PDF to show while actual doc PDF is being generated

The Preview Merge use case then utilizes this library by including an iframe in the ComposerMerge.cmp component which 
references the previewMergeViewer.html file.

To use this PDF.js library for another use case within the Composer package:
- make another fork of the viewer.html file, and add an iframe in the appropriate Composer component which references that forked html file
- fork and add other supporting js and css files as needed to support your use case in your html file


