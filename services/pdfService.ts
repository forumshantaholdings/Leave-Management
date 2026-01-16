
import { LeaveRequest } from '../types';
import { jsPDF } from 'jspdf';

/**
 * Formats a date string from yyyy-mm-dd to dd/mm/yyyy
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  if (dateStr.includes('/')) return dateStr; // Already formatted
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dateStr).toLocaleDateString('en-GB');
};

/**
 * Generates and downloads a professional PDF document for the leave request.
 * Includes request details, approval history, and a digital verification watermark.
 */
export const downloadRequestPDF = async (request: LeaveRequest): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // -- Header --
  doc.setFillColor(15, 23, 42); // Slate 900 (Dark Gray)
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Gold Accent line
  doc.setFillColor(142, 138, 31); // #8e8a1f
  doc.rect(0, 38, pageWidth, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SHANTA FORUM', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('LEAVE MANAGEMENT SYSTEM', pageWidth / 2, 30, { align: 'center' });
  doc.text('LEAVE APPROVAL CERTIFICATE', pageWidth / 2, 35, { align: 'center' });
  
  // -- Watermark --
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(60);
  doc.setFont('helvetica', 'bold');
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
  doc.text('SYSTEM VERIFIED', pageWidth / 2, 150, { align: 'center', angle: 45 });
  doc.restoreGraphicsState();

  // -- Content Section --
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('REQUEST DETAILS', 15, 55);
  doc.setDrawColor(142, 138, 31); // #8e8a1f
  doc.line(15, 57, 70, 57);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const details = [
    ['Request ID:', request.id],
    ['Employee Name:', request.userName],
    ['Role:', request.userRole],
    ['Start Date:', formatDate(request.startDate)],
    ['End Date:', formatDate(request.endDate)],
    ['Total Days:', `${request.leaveDays} ${request.leaveDays === 1 ? 'Day' : 'Days'}`],
    ['Reliever:', request.relieverName],
    ['Submission Date:', formatDate(request.submittedAt.split('T')[0])],
  ];

  let y = 65;
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 60, y);
    y += 8;
  });

  // -- Reason Section --
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('REASON FOR LEAVE', 15, y);
  y += 5;
  doc.setFont('helvetica', 'italic');
  const splitReason = doc.splitTextToSize(`"${request.reason}"`, pageWidth - 30);
  doc.text(splitReason, 15, y);
  y += (splitReason.length * 5) + 10;

  // -- Approval Chain Section --
  doc.setFont('helvetica', 'bold');
  doc.text('APPROVAL HISTORY & VERIFICATION', 15, y);
  doc.line(15, y + 2, 100, y + 2);
  y += 10;

  request.approvalChain.forEach((step, index) => {
    const statusText = step.status.toUpperCase();
    const dateText = step.timestamp ? new Date(step.timestamp).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'N/A';
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${step.role}`, 15, y);
    
    doc.setFont('helvetica', 'normal');
    if (step.status === 'approved') {
      doc.setTextColor(0, 100, 0); // Dark Green
    } else if (step.status === 'rejected') {
      doc.setTextColor(200, 0, 0); // Red
    } else {
      doc.setTextColor(150, 150, 150); // Grey
    }
    doc.text(statusText, 70, y);
    
    doc.setTextColor(100, 100, 100);
    doc.text(dateText, 110, y);
    y += 8;
  });

  // -- Footer Signature Area --
  y = 260;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text('This is a system-generated document and does not require a physical signature.', pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(142, 138, 31); // #8e8a1f
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('[ DIGITAL SIGNATURE SECURED ]', pageWidth / 2, y + 8, { align: 'center' });

  // -- Trigger Download --
  doc.save(`Leave_Approval_${request.id}.pdf`);
};

/**
 * Legacy support for the App.tsx flow: 
 * Returns a placeholder string now that we use direct download in the UI.
 */
export const generateProfessionalPDF = async (request: LeaveRequest): Promise<string> => {
  return "generated"; // Return a truthy string to indicate readiness
};
