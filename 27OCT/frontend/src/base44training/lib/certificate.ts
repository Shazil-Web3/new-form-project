export async function downloadCertificate(employeeName, classTitle, certificate) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const centerX = width / 2;

  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(1.5);
  doc.rect(10, 10, width - 20, doc.internal.pageSize.getHeight() - 20);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(124, 58, 237);
  doc.text('CERTIFICATE OF COMPLETION', centerX, 45, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.setFont(undefined, 'normal');
  doc.text('This certifies that', centerX, 65, { align: 'center' });

  doc.setFontSize(26);
  doc.setTextColor(20);
  doc.setFont(undefined, 'bold');
  doc.text(employeeName, centerX, 80, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(90);
  doc.text('has successfully completed', centerX, 93, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.setFont(undefined, 'bold');
  doc.text(classTitle, centerX, 105, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(110);
  doc.text(`Issued ${certificate.issued_date}${certificate.expiry_date ? `  ·  Valid until ${certificate.expiry_date}` : ''}`, centerX, 118, { align: 'center' });
  doc.text(`Validation ID: ${certificate.validation_id}`, centerX, 125, { align: 'center' });

  doc.save(`certificate-${classTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}
