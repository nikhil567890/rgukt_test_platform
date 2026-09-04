import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User, StudentStats, Attempt } from '../types';

interface PdfReportOptions {
  user: User;
  stats: StudentStats;
  attemptsHistory: Attempt[];
  subscription?: {
    isPremium: boolean;
    status: string;
    premiumSince: string | null;
    premiumExpiresAt: string | null;
    daysRemaining: number | null;
    validityDays: number;
  };
  payments?: Array<{
    id: string;
    razorpayOrderId: string;
    razorpayPaymentId?: string | null;
    amountINR: number;
    status: string;
    createdAt: string;
    paymentMethod: string;
  }>;
}

export function generatePdfReport({ user, stats, attemptsHistory, subscription, payments }: PdfReportOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Color Palette
  const primaryColor: [number, number, number] = [30, 27, 75]; // Slate 900
  const brandIndigo: [number, number, number] = [79, 70, 229]; // Indigo 600
  const accentAmber: [number, number, number] = [245, 158, 11]; // Amber 500
  const bgLight: [number, number, number] = [248, 250, 252]; // Slate 50
  const textColor: [number, number, number] = [30, 41, 59]; // Slate 800

  // 1. Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('VINODH SIR TEST SERIES', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('RGUKT CET 2026 Student Progress & Subscription Report', 14, 18);

  const reportDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc.setFontSize(8);
  doc.text(`Generated on: ${reportDate}`, pageWidth - 14, 18, { align: 'right' });

  // Accent Line
  doc.setFillColor(...brandIndigo);
  doc.rect(0, 28, pageWidth, 2, 'F');

  let currentY = 35;

  // 2. Student Details & Subscription Validity Box
  const boxHeight = subscription ? 36 : 28;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, boxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(`Student Profile: ${user?.name || 'Student'}`, 18, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text(`Email: ${user?.email || 'N/A'}`, 18, currentY + 13);
  doc.text(`Current Streak: ${stats?.currentStreak || 0} Days (Longest: ${stats?.longestStreak || 0} Days)`, 18, currentY + 19);

  if (subscription) {
    const activationDateStr = subscription.premiumSince ? new Date(subscription.premiumSince).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
    const expiryDateStr = subscription.premiumExpiresAt ? new Date(subscription.premiumExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
    const daysRem = subscription.daysRemaining !== null ? `${subscription.daysRemaining} days` : 'N/A';

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`365-Day Membership: ${activationDateStr} to ${expiryDateStr} (${daysRem} remaining)`, 18, currentY + 26);
  }

  // Summary Metrics Badges
  const boxX = pageWidth - 85;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...brandIndigo);
  doc.text(`Avg Score: ${stats?.avgScorePercentage || 0}%`, boxX, currentY + 9);
  doc.setTextColor(...textColor);
  doc.text(`Tests Attempted: ${stats?.totalAttemptsCount || 0} of ${stats?.totalAvailableTests || 0}`, boxX, currentY + 16);

  const statusLabel = user.role === 'ADMIN' ? 'ADMIN ACCESS' : user.isPremium ? '365-DAY PREMIUM' : 'FREE TIER';
  doc.setTextColor(user.isPremium || user.role === 'ADMIN' ? 16 : 180, user.isPremium || user.role === 'ADMIN' ? 122 : 83, user.isPremium || user.role === 'ADMIN' ? 87 : 9);
  doc.text(`Status: ${statusLabel}`, boxX, currentY + 23);

  currentY += boxHeight + 8;

  // 3. Performance Summary & Topper Benchmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('1. Topper Benchmark Comparison', 14, currentY);

  currentY += 4;

  // Compute subject wise breakdown
  const subjects = ['Mathematics', 'Algebra', 'Trigonometry'];
  const subjectSummary = subjects.map((sub) => {
    const subAttempts = attemptsHistory.filter(
      (a) => (a.subject || '').toLowerCase() === sub.toLowerCase()
    );
    if (subAttempts.length === 0) {
      return {
        subject: sub,
        attemptsCount: 0,
        avgScorePct: stats.avgScorePercentage || 0,
        topperAvgPct: 95,
        gap: Math.max(0, 95 - (stats.avgScorePercentage || 0)),
      };
    }
    const totalScore = subAttempts.reduce((sum, a) => sum + a.score, 0);
    const totalMarks = subAttempts.reduce((sum, a) => sum + a.totalMarks, 0);
    const avgScorePct = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;
    
    const topperScore = subAttempts.reduce((sum, a) => sum + a.topperScore, 0);
    const topperAvgPct = totalMarks > 0 ? Math.round((topperScore / totalMarks) * 100) : 95;

    return {
      subject: sub,
      attemptsCount: subAttempts.length,
      avgScorePct,
      topperAvgPct,
      gap: Math.max(0, topperAvgPct - avgScorePct),
    };
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Subject', 'Attempts', 'Your Avg Score %', 'Top 10% Topper %', 'Gap to Topper', 'Status']],
    body: subjectSummary.map((item) => [
      item.subject,
      item.attemptsCount,
      `${item.avgScorePct}%`,
      `${item.topperAvgPct}%`,
      item.gap === 0 ? '0% (At Par)' : `-${item.gap}%`,
      item.gap <= 5 ? 'Top Ranker' : item.gap <= 15 ? 'Competitive' : 'Needs Practice',
    ]),
    margin: { left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: textColor,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
  });

  // Get table Y after rendering
  const lastTableY = (doc as any).lastAutoTable.finalY || currentY + 30;
  currentY = lastTableY + 10;

  // 4. Test Attempt History Log
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('2. Exam History & Detailed Test Papers Log', 14, currentY);

  currentY += 4;

  if (attemptsHistory.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No mock tests attempted yet.', 14, currentY + 6);
  } else {
    autoTable(doc, {
      startY: currentY,
      head: [['Date', 'Test Paper Title', 'Subject', 'Your Score', 'Topper Score', 'Score %', 'Time Taken']],
      body: attemptsHistory.map((att) => {
        const studentPct = Math.round((att.score / att.totalMarks) * 100);
        const mins = Math.floor(att.timeTakenSec / 60);
        const secs = att.timeTakenSec % 60;
        const formattedDate = new Date(att.submittedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        });

        return [
          formattedDate,
          att.testTitle,
          att.subject,
          `${att.score} / ${att.totalMarks}`,
          `${att.topperScore} / ${att.totalMarks}`,
          `${studentPct}%`,
          `${mins}m ${secs}s`,
        ];
      }),
      margin: { left: 14, right: 14 },
      theme: 'grid',
      headStyles: {
        fillColor: brandIndigo,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: textColor,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  if (payments && payments.length > 0) {
    const attemptsTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : currentY + 10;
    let paymentY = attemptsTableY + 12;

    // Check page height limit
    if (paymentY > 230) {
      doc.addPage();
      paymentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text('3. Payment & Subscription Transactions History', 14, paymentY);

    paymentY += 4;

    autoTable(doc, {
      startY: paymentY,
      head: [['Date', 'Razorpay Order ID', 'Payment ID', 'Amount', 'Status', 'Payment Method']],
      body: payments.map((p) => {
        const formattedDate = new Date(p.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        return [
          formattedDate,
          p.razorpayOrderId,
          p.razorpayPaymentId || 'N/A',
          `Rs. ${p.amountINR} INR`,
          p.status === 'PAID' ? 'PAID / VERIFIED' : p.status,
          p.paymentMethod || 'Razorpay Gateway',
        ];
      }),
      margin: { left: 14, right: 14 },
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: textColor,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 287, pageWidth, 10, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Vinodh Sir Test Series — Confidential Student Progress Report',
      14,
      292
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, 292, { align: 'right' });
  }

  // Save the generated PDF
  const sanitizedName = user.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`RGUKT_CET_Report_${sanitizedName}.pdf`);
}
