function ascii(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/₹/g, 'INR ')
    .replace(/[✓✔]/g, '[complete]')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '')
}

function wrapLine(value: string, width = 88): string[] {
  const line = ascii(value).trimEnd()
  if (!line) return ['']
  const words = line.split(/\s+/)
  const wrapped: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) current = word
    else if (`${current} ${word}`.length <= width) current += ` ${word}`
    else {
      wrapped.push(current)
      current = word
    }
  }
  if (current) wrapped.push(current)
  return wrapped
}

function pdfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function createTextPdf(lines: string[]): Blob {
  const wrapped = lines.flatMap((line) => wrapLine(line))
  const linesPerPage = 50
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(wrapped.length / linesPerPage)) },
    (_, index) => wrapped.slice(index * linesPerPage, (index + 1) * linesPerPage),
  )
  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2)
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  pages.forEach((pageLines, index) => {
    const pageObject = pageObjectNumbers[index]
    const contentObject = pageObject + 1
    const commands = [
      'BT',
      '/F1 10 Tf',
      '50 790 Td',
      '14 TL',
      ...pageLines.flatMap((line) => [`(${pdfString(line)}) Tj`, 'T*']),
      'ET',
    ].join('\n')
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`
    objects[contentObject] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`
  })

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
