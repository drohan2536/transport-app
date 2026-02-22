import * as pdfFonts from 'pdfmake/build/vfs_fonts.js';
console.log("pdfFonts KEYS:", Object.keys(pdfFonts));
const vfsObj = pdfFonts.default?.pdfMake?.vfs || pdfFonts.pdfMake?.vfs || pdfFonts.vfs;
console.log("vfsObj TYPE:", typeof vfsObj, "KEYS:", vfsObj ? Object.keys(vfsObj).length : 0);
