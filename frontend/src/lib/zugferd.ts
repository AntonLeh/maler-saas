// ZUGFeRD 2 / Factur-X (Profil EN 16931): PDF/A-3b mit eingebetteter Rechnungsdatei „factur-x.xml“.
// Ablauf: jsPDF erstellt die Rechnung mit eingebetteter Schrift → hier werden XML, Farbprofil und
// PDF/A-Kennzeichnung (XMP) ergänzt. Läuft komplett im Browser.

import { PDFArray, PDFDict, PDFDocument, PDFHeader, PDFHexString, PDFName, PDFString } from "pdf-lib";

// sRGB-Farbprofil (sRGB IEC61966-2.1, Graeme W. Gill, gemeinfrei), 3 KB
import { SRGB_ICC_BASE64 } from "./srgbIcc";

const xmlEsc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

let fontCache: Promise<{ regular: string; bold: string }> | null = null;

/** Schrift (Liberation Sans, SIL OFL 1.1) aus /fonts laden – einmal pro Sitzung */
export function loadPdfFonts(): Promise<{ regular: string; bold: string }> {
  if (!fontCache) {
    const get = async (f: string) => {
      const res = await fetch(`/fonts/${f}`);
      if (!res.ok) throw new Error(`Schrift ${f} konnte nicht geladen werden`);
      return bytesToB64(new Uint8Array(await res.arrayBuffer()));
    };
    fontCache = Promise.all([get("LiberationSans-Regular.ttf"), get("LiberationSans-Bold.ttf")])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((e) => {
        fontCache = null;
        throw e;
      });
  }
  return fontCache;
}

const BOM = String.fromCharCode(0xfeff);
const isoSec = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

function xmp(meta: { title: string; author: string; subject: string; producer: string; creator: string; date: Date }) {
  const d = isoSec(meta.date);
  return `<?xpacket begin="${BOM}" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
<pdfaid:part>3</pdfaid:part>
<pdfaid:conformance>B</pdfaid:conformance>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:format>application/pdf</dc:format>
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(meta.title)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${xmlEsc(meta.author)}</rdf:li></rdf:Seq></dc:creator>
<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(meta.subject)}</rdf:li></rdf:Alt></dc:description>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
<pdf:Producer>${xmlEsc(meta.producer)}</pdf:Producer>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
<xmp:CreatorTool>${xmlEsc(meta.creator)}</xmp:CreatorTool>
<xmp:CreateDate>${d}</xmp:CreateDate>
<xmp:ModifyDate>${d}</xmp:ModifyDate>
<xmp:MetadataDate>${d}</xmp:MetadataDate>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
<fx:DocumentType>INVOICE</fx:DocumentType>
<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
<fx:Version>1.0</fx:Version>
<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas>
<rdf:Bag>
<rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property>
<rdf:Seq>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description></rdf:li>
</rdf:Seq>
</pdfaSchema:property>
</rdf:li>
</rdf:Bag>
</pdfaExtension:schemas>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** Macht aus dem jsPDF-Ergebnis (mit eingebetteter Schrift) ein ZUGFeRD-PDF/A-3b */
export async function toZugferdPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  xml: string,
  meta: { title: string; author: string; subject?: string; date?: Date }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const ctx = doc.context;
  ctx.header = PDFHeader.forVersion(1, 7);
  const date = new Date(Math.floor((meta.date ?? new Date()).getTime() / 1000) * 1000);
  const info = { title: meta.title, author: meta.author, subject: meta.subject ?? meta.title, producer: "Maler-SaaS (pdf-lib)", creator: "Maler-SaaS" };

  // 1) nicht eingebettete Standardschriften entfernen (jsPDF trägt sie immer ein, benutzt werden sie nicht)
  for (const page of doc.getPages()) {
    const fonts = page.node.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict);
    if (!fonts) continue;
    for (const [key, ref] of fonts.entries()) {
      const f = ctx.lookup(ref);
      if (f instanceof PDFDict && f.get(PDFName.of("Subtype")) === PDFName.of("Type1") && !f.get(PDFName.of("FontDescriptor"))) fonts.delete(key);
    }
  }

  // 2) Rechnungsdaten einbetten (factur-x.xml, Beziehung „Alternative“)
  const xmlBytes = new TextEncoder().encode(xml);
  const pdfDate = PDFString.fromDate(date);
  const fileStream = ctx.flateStream(xmlBytes, {
    Type: "EmbeddedFile",
    Subtype: "text/xml",
    Params: { Size: xmlBytes.length, ModDate: pdfDate, CreationDate: pdfDate },
  });
  const fileRef = ctx.register(fileStream);
  const fileSpec = ctx.obj({
    Type: "Filespec",
    F: PDFString.of("factur-x.xml"),
    UF: PDFHexString.fromText("factur-x.xml"),
    EF: { F: fileRef, UF: fileRef },
    Desc: PDFHexString.fromText("Rechnungsdaten (ZUGFeRD / Factur-X, EN 16931)"),
    AFRelationship: PDFName.of("Alternative"),
  });
  const fileSpecRef = ctx.register(fileSpec);
  const names = ctx.obj({ EmbeddedFiles: { Names: [PDFHexString.fromText("factur-x.xml"), fileSpecRef] } });
  doc.catalog.set(PDFName.of("Names"), names);
  doc.catalog.set(PDFName.of("AF"), ctx.obj([fileSpecRef]));

  // 3) Farbprofil (OutputIntent)
  const icc = ctx.flateStream(b64ToBytes(SRGB_ICC_BASE64), { N: 3 });
  doc.catalog.set(
    PDFName.of("OutputIntents"),
    ctx.obj([
      {
        Type: "OutputIntent",
        S: "GTS_PDFA1",
        OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
        Info: PDFString.of("sRGB IEC61966-2.1"),
        RegistryName: PDFString.of("http://www.color.org"),
        DestOutputProfile: ctx.register(icc),
      },
    ])
  );

  // 4) Metadaten – Info-Wörterbuch und XMP müssen übereinstimmen
  const infoRef = ctx.trailerInfo.Info;
  const infoDict = infoRef ? ctx.lookup(infoRef) : null;
  if (infoDict instanceof PDFDict) {
    for (const k of [...infoDict.keys()]) infoDict.delete(k);
  }
  doc.setTitle(info.title);
  doc.setAuthor(info.author);
  doc.setSubject(info.subject);
  doc.setCreator(info.creator);
  doc.setProducer(info.producer);
  doc.setCreationDate(date);
  doc.setModificationDate(date);
  const metaStream = ctx.stream(new TextEncoder().encode(xmp({ ...info, date })), { Type: "Metadata", Subtype: "XML" });
  doc.catalog.set(PDFName.of("Metadata"), ctx.register(metaStream));
  doc.catalog.set(PDFName.of("MarkInfo"), ctx.obj({ Marked: false }));
  doc.catalog.delete(PDFName.of("OpenAction"));

  // 5) Dokument-ID (Pflicht bei PDF/A)
  const id = PDFHexString.of(
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
  ctx.trailerInfo.ID = ctx.obj([id, id]) as PDFArray;

  return doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
}
