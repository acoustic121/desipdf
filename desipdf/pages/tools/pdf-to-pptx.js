import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import toast from 'react-hot-toast'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'pdf-to-pptx')
const EMU_PER_INCH = 914400

const SLIDE_SIZES = {
  wide: { label: 'Widescreen 16:9', width: 13.333333, height: 7.5 },
  standard: { label: 'Standard 4:3', width: 10, height: 7.5 },
}

function xml(strings, ...values) {
  return strings.reduce((result, string, index) => `${result}${string}${values[index] ?? ''}`, '')
}

function toEmu(inches) {
  return Math.round(inches * EMU_PER_INCH)
}

function getImagePlacement(imageWidth, imageHeight, slide) {
  const imageRatio = imageWidth / imageHeight
  const slideRatio = slide.width / slide.height
  const width = imageRatio > slideRatio ? slide.width : slide.height * imageRatio
  const height = imageRatio > slideRatio ? slide.width / imageRatio : slide.height

  return {
    x: toEmu((slide.width - width) / 2),
    y: toEmu((slide.height - height) / 2),
    width: toEmu(width),
    height: toEmu(height),
  }
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function createSlideXml(index, placement, slide) {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="${toEmu(slide.width)}" cy="${toEmu(slide.height)}"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="${toEmu(slide.width)}" cy="${toEmu(slide.height)}"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${index + 1}" name="PDF Page ${index}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${placement.x}" y="${placement.y}"/>
            <a:ext cx="${placement.width}" cy="${placement.height}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`
}

function createSlideRelsXml(slideNumber) {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${slideNumber}.jpg"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
}

function createContentTypesXml(slideCount) {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => (
    `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  )).join('')

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`
}

function createRootRelsXml() {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function createPresentationXml(slideCount, slide) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => (
    `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`
  )).join('')

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${toEmu(slide.width)}" cy="${toEmu(slide.height)}" type="custom"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`
}

function createPresentationRelsXml(slideCount) {
  const slideRels = Array.from({ length: slideCount }, (_, index) => (
    `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`
  )).join('')

  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
</Relationships>`
}

function createSlideMasterXml() {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`
}

function createSlideMasterRelsXml() {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
}

function createSlideLayoutXml() {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`
}

function createSlideLayoutRelsXml() {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
}

function createThemeXml() {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PDFChampion">
  <a:themeElements>
    <a:clrScheme name="PDFChampion"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F9FAFB"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="06B6D4"/></a:accent2><a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="EF4444"/></a:accent5><a:accent6><a:srgbClr val="8B5CF6"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="PDFChampion"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="PDFChampion"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`
}

function createAppXml(slideCount) {
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>PDFChampion</Application>
  <PresentationFormat>On-screen Show</PresentationFormat>
  <Slides>${slideCount}</Slides>
  <Company>PDFChampion</Company>
</Properties>`
}

function createCoreXml() {
  const now = new Date().toISOString()
  return xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>PDF to PPT</dc:title>
  <dc:creator>PDFChampion</dc:creator>
  <cp:lastModifiedBy>PDFChampion</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

async function renderPdfPages(file, scale) {
  const { loadPdfJs } = await import('../../utils/clientLoader')
  const pdfjs = await loadPdfJs()
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    await page.render({ canvasContext: context, viewport }).promise
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error(`Unable to render page ${index}`)
    pages.push({ blob, width: canvas.width, height: canvas.height })
  }

  return pages
}

async function createPptx(pages, slideSize) {
  const { loadJsZip } = await import('../../utils/clientLoader')
  const JSZip = await loadJsZip()
  const zip = new JSZip()
  const slide = SLIDE_SIZES[slideSize] || SLIDE_SIZES.wide

  zip.file('[Content_Types].xml', createContentTypesXml(pages.length))
  zip.file('_rels/.rels', createRootRelsXml())
  zip.file('docProps/app.xml', createAppXml(pages.length))
  zip.file('docProps/core.xml', createCoreXml())
  zip.file('ppt/presentation.xml', createPresentationXml(pages.length, slide))
  zip.file('ppt/_rels/presentation.xml.rels', createPresentationRelsXml(pages.length))
  zip.file('ppt/slideMasters/slideMaster1.xml', createSlideMasterXml())
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', createSlideMasterRelsXml())
  zip.file('ppt/slideLayouts/slideLayout1.xml', createSlideLayoutXml())
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', createSlideLayoutRelsXml())
  zip.file('ppt/theme/theme1.xml', createThemeXml())

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    const slideNumber = index + 1
    const placement = getImagePlacement(page.width, page.height, slide)
    zip.file(`ppt/slides/slide${slideNumber}.xml`, createSlideXml(slideNumber, placement, slide))
    zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, createSlideRelsXml(slideNumber))
    zip.file(`ppt/media/image${slideNumber}.jpg`, await blobToBase64(page.blob), { base64: true })
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
}

export default function PdfToPptx() {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState('1.5')
  const [slideSize, setSlideSize] = useState('wide')
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handleConvert = async () => {
    if (!file) {
      toast.error('Please upload a PDF first')
      return
    }

    await runClientSide(async () => {
      const pages = await renderPdfPages(file, Number(quality))
      if (!pages.length) throw new Error('No PDF pages found')
      return createPptx(pages, slideSize)
    }, file.name.replace(/\.pdf$/i, '.pptx'))
  }

  return (
    <>
      <ToolSeoHead tool={tool} />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFile} accept=".pdf" label="Drop your PDF file here" sublabel="Each PDF page becomes one PowerPoint slide" />

        {file && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Slide Size</label>
                <select value={slideSize} onChange={(event) => setSlideSize(event.target.value)} className="input-field">
                  {Object.entries(SLIDE_SIZES).map(([value, option]) => (
                    <option key={value} value={value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Render Quality</label>
                <select value={quality} onChange={(event) => setQuality(event.target.value)} className="input-field">
                  <option value="1">Standard - smaller file</option>
                  <option value="1.5">High - recommended</option>
                  <option value="2">Ultra - larger file</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
              This creates an editable PowerPoint file with one high-quality PDF page image per slide. You can add text, shapes, and notes in PowerPoint after download.
            </div>

            <button onClick={handleConvert} disabled={loading} className="btn-primary w-full justify-center py-3.5">
              {loading ? 'Converting to PPT...' : 'Convert PDF to PPT'}
            </button>
          </div>
        )}
      </ToolLayout>
    </>
  )
}
