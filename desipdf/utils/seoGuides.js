export const SEO_GUIDES = {
  'merge-pdf': {
    steps: [
      'Select two or more PDF files by clicking the upload area or dragging and dropping them.',
      'Drag and drop the files to rearrange them in the exact order you want them combined.',
      'Click the "Merge PDFs" button to combine your documents.',
      'The combined PDF will be generated instantly and downloaded straight to your device.'
    ],
    benefits: [
      { title: 'Zero Server Uploads', desc: 'Your documents never leave your computer. Processing happens 100% in your local browser.' },
      { title: 'Drag & Drop Reordering', desc: 'Easily rearrange files in a click to make sure pages flow exactly as intended.' },
      { title: 'Combine Large Files', desc: 'Merge files of any size without limitations on our premium tier.' }
    ],
    faqs: [
      { q: 'Is it safe to merge confidential documents on PDFChampion?', a: 'Yes. Unlike other websites that upload your files to their cloud servers, PDFChampion combines PDFs directly in your web browser. Your sensitive files never leave your device.' },
      { q: 'Does merging PDFs reduce the quality of pages?', a: 'No, our merging engine links pages without altering text, layouts, fonts, or images, ensuring 100% original quality is preserved.' },
      { q: 'How many PDF files can I combine?', a: 'Free users can combine up to 10 files in a single merge, up to 15 times a day. Premium users get unlimited files per merge.' }
    ]
  },
  'compress-pdf': {
    steps: [
      'Upload a PDF document from your device.',
      'Our browser-based compression engine analyzes and optimizes the file layout and images.',
      'Once complete, the compressed PDF downloads automatically showing you how much space was saved.'
    ],
    benefits: [
      { title: 'Maintain Legibility', desc: 'Compresses images and removes redundant metadata while keeping text crisp and legible.' },
      { title: 'Fast Local Processing', desc: 'No uploading means you save bandwidth and get your compressed file in seconds.' },
      { title: 'Email-Friendly Files', desc: 'Shrink large PDFs to under 10MB or 20MB so you can easily send them via email or upload to online forms.' }
    ],
    faqs: [
      { q: 'How does local compression work?', a: 'PDFChampion uses modern web technologies (WebAssembly) to compress your PDF files client-side. The file is optimized inside your browser cache, maintaining complete privacy.' },
      { q: 'Will my images look blurry after compression?', a: 'We optimize images using smart downscaling that reduces file size while retaining high resolution for reading and printing.' }
    ]
  },
  'jpg-to-pdf': {
    steps: [
      'Upload one or multiple JPG, PNG, or WebP images.',
      'Optionally reorder the images to define their page order in the output PDF.',
      'Click "Convert to PDF" to generate your high-quality document instantly.'
    ],
    benefits: [
      { title: 'Batch Conversion', desc: 'Convert multiple images into a single formatted PDF document in one click.' },
      { title: 'Supports All Formats', desc: 'Works seamlessly with JPG, JPEG, PNG, and WebP image formats.' },
      { title: 'Perfect Layouts', desc: 'Fits your images perfectly onto clean PDF pages without stretching or margins.' }
    ],
    faqs: [
      { q: 'Can I convert multiple photos into one PDF?', a: 'Yes. You can upload multiple images at once, rearrange them, and export them into a single continuous PDF document.' },
      { q: 'Are my personal images uploaded to a server?', a: 'No. Just like all our tools, the image-to-PDF conversion runs locally in your browser. Your photos are never sent to our servers.' }
    ]
  },
  'word-to-pdf': {
    steps: [
      'Select a Microsoft Word document (.doc or .docx) from your computer.',
      'Our secure converter parses the Word text, layouts, and styles.',
      'Click convert and download your perfectly formatted PDF file.'
    ],
    benefits: [
      { title: 'Retain Formatting', desc: 'Maintains fonts, margins, tables, and layouts exactly as you designed them in Word.' },
      { title: 'Secure Conversion', desc: 'Your private business documents are processed in-browser, guaranteeing complete safety.' },
      { title: 'Cross-Platform Compatibility', desc: 'Create standard PDFs that look identical on any computer, tablet, or smartphone.' }
    ],
    faqs: [
      { q: 'Does PDFChampion support .docx formats?', a: 'Yes, we fully support converting both legacy .doc files and modern .docx Word files to PDF.' },
      { q: 'Will my document formatting change?', a: 'Our engine is designed to preserve your margins, alignment, headers, footers, and bullet lists with high precision.' }
    ]
  },
  'pdf-to-word': {
    steps: [
      'Upload the PDF file you wish to edit.',
      'Our local extraction engine reads the text paragraphs and tabular data.',
      'Export the file into an editable Microsoft Word document (.docx).'
    ],
    benefits: [
      { title: 'Fully Editable Text', desc: 'Converts PDF contents into structured paragraphs and tables that you can easily edit in Microsoft Word.' },
      { title: 'Fast Conversion', desc: 'Since the file is processed locally, get your editable Word file in a fraction of a second.' },
      { title: 'High Accuracy', desc: 'Extracts formatting, tables, and paragraph structures to minimize manual formatting fixes.' }
    ],
    faqs: [
      { q: 'Can I convert scanned PDFs to editable Word files?', a: 'For scanned PDFs, we recommend running our OCR tool first to recognize the text, which can then be exported as an editable document.' },
      { q: 'Is my data safe during PDF to Word conversion?', a: 'Absolutely. The extraction process runs inside your local browser tab, so your data never touches a server.' }
    ]
  },
  'unlock-pdf': {
    steps: [
      'Select the password-protected or locked PDF document.',
      'If the file has an owner password (restricting printing or copying), we unlock it instantly.',
      'If the file requires a user password to open, type the password once to decrypt and save a permanently unlocked copy.'
    ],
    benefits: [
      { title: 'Remove Copy/Print Restrictions', desc: 'Instantly strip PDF permissions that block you from copying text or printing pages.' },
      { title: 'Permanent Decryption', desc: 'Decrypt your file once so you do not have to type the password every time you open it.' },
      { title: '100% Client-Side Decryption', desc: 'Decryption happens locally, ensuring your file password is never transmitted across the internet.' }
    ],
    faqs: [
      { q: 'Can I unlock a PDF if I do not know the open password?', a: 'No, you must provide the open password once to decrypt the file. PDFChampion does not support hacking user-password protected files, but it strips all printing, editing, and copying restrictions instantly without a password.' },
      { q: 'Is my PDF password secure?', a: 'Yes. Since decryption runs locally in your browser, your password is never sent to any server or database.' }
    ]
  }
}
