import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from 'date-fns'

interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface Invoice {
  invoice_number: string
  invoice_date: string
  due_date: string
  client: {
    name: string
    address?: string | null
    phone?: string | null
    email?: string | null
  }
  invoice_items: InvoiceItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  notes?: string | null
}

// Currency formatting function
const formatCurrency = (value: number) =>
  `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`

export const generateInvoicePDF = (invoice: Invoice) => {
  const doc = new jsPDF()

  // ===== COMPANY HEADER =====
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("AXIOM AI", 14, 20)

  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text("PROFORMA INVOICE", 14, 28)

  doc.setFontSize(10)
  doc.text("Company ID: AXIOMAI", 140, 20)
  doc.text("Bangalore, Karnataka, India", 140, 26)
  doc.text("Phone: 9886709463", 140, 32)

  // ===== BILL TO SECTION =====
  doc.setFontSize(11)
  doc.text("Bill To:", 14, 45)
  doc.text(invoice.client.name, 14, 51)
  doc.text(invoice.client.address || "India", 14, 57)
  doc.text(`Phone: ${invoice.client.phone || ""}`, 14, 63)

  // ===== ITEMS TABLE =====
  autoTable(doc, {
    startY: 75,
    head: [["#", "Item Description", "Qty", "Rate", "Amount"]],
    body: invoice.invoice_items.map((item, i) => [
      i + 1,
      item.description,
      item.quantity.toString(),
      formatCurrency(Number(item.unit_price)),
      formatCurrency(Number(item.total))
    ]),
    headStyles: { 
      fillColor: [37, 99, 235], // blue header
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 4
    },
    columnStyles: {
      0: { cellWidth: 15 }, // #
      1: { cellWidth: 'auto' }, // Description
      2: { cellWidth: 25 }, // Qty
      3: { cellWidth: 40 }, // Rate
      4: { cellWidth: 45 } // Amount
    }
  })

  // ===== TOTAL SECTION (RIGHT ALIGNED) =====
  const finalY = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Subtotal: ${formatCurrency(invoice.subtotal)}`, 140, finalY)
  doc.text(`Tax: ${formatCurrency(invoice.tax || 0)}`, 140, finalY + 6)
  doc.text(`Discount: ${formatCurrency(invoice.discount || 0)}`, 140, finalY + 12)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(`Total: ${formatCurrency(invoice.total)}`, 140, finalY + 20)

  // ===== NOTES SECTION =====
  if (invoice.notes) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text("Notes:", 14, finalY + 35)
    const notesLines = doc.splitTextToSize(invoice.notes, 120)
    doc.text(notesLines, 14, finalY + 41)
  }

  // ===== FOOTER TEXT =====
  const footerY = finalY + 60
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Thank you for your business!", 14, footerY)
  doc.text("For queries, contact AXIOM AI", 14, footerY + 6)
  doc.text("Payment Terms: Due upon receipt", 14, footerY + 12)

  // ===== BANK DETAILS =====
  doc.setFontSize(9)
  doc.text("Bank Details:", 14, footerY + 25)
  doc.text("Account Name: AXIOM AI", 14, footerY + 31)
  doc.text("Bank: ICICI Bank", 14, footerY + 37)
  doc.text("Account No: 10095001122", 14, footerY + 43)
  doc.text("Branch: Banashankari 3rd Stage", 14, footerY + 49)
  doc.text("IFSC: ICIC000109", 14, footerY + 55)

  // ===== SAVE PDF =====
  doc.save(`Invoice_${invoice.invoice_number}.pdf`)
}
