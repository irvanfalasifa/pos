import { formatRupiah } from '../lib/format'
import { orderTypeLabel, paymentMethodLabel } from '../lib/labels'
import { formatPercent } from '../lib/pricing'
import type { Order, PosConfig } from '../services/pos'

function Row({ left, right, bold = false }: { left: string; right?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? 'font-bold' : ''}`}>
      <span>{left}</span>
      {right !== undefined && <span className="shrink-0">{right}</span>}
    </div>
  )
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-black" />
}

export default function Receipt({
  order,
  config,
  isCopy = false,
}: {
  order: Order
  config: PosConfig | undefined
  isCopy?: boolean
}) {
  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
  const balance = order.total - paid
  const refunded = order.refunds.reduce((sum, r) => sum + r.amount, 0)
  const narrow = config?.receiptPaper === '58'

  return (
    <div
      className={`mx-auto w-full bg-white p-4 font-mono leading-snug text-black print:max-w-none print:p-0 ${
        narrow ? 'max-w-52 text-[10px] print:w-[48mm]' : 'max-w-xs text-xs print:w-[72mm]'
      }`}
    >
      {isCopy && <p className="mb-2 text-center font-bold">*** SALINAN ***</p>}

      <p className="text-center text-sm font-bold">{config?.businessName ?? 'POS Restoran'}</p>
      {config?.businessAddress && <p className="text-center">{config.businessAddress}</p>}
      {config?.businessPhone && <p className="text-center">Telp {config.businessPhone}</p>}

      <Divider />
      <Row left="No" right={order.number} />
      <Row
        left="Tanggal"
        right={new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
      />
      <Row left="Kasir" right={order.createdBy.name} />
      <Row left="Layanan" right={`${orderTypeLabel[order.type]}${order.table ? ` · Meja ${order.table.name}` : ''}`} />
      {order.customerName && <Row left="Pelanggan" right={order.customerName} />}

      <Divider />
      {order.items.map((item) => (
        <div key={item.id} className="mb-1.5">
          <div>
            {item.productName}
            {item.variantName ? ` (${item.variantName})` : ''}
          </div>
          <div className="pl-2">
            <Row left={`${item.quantity} x ${formatRupiah(item.unitPrice)}`} right={formatRupiah(item.lineTotal)} />
            {item.modifiers.length > 0 && <div>+ {item.modifiers.map((m) => m.name).join(', ')}</div>}
            {item.note && <div className="italic">“{item.note}”</div>}
          </div>
        </div>
      ))}

      <Divider />
      <Row left="Subtotal" right={formatRupiah(order.subtotal)} />
      {order.serviceAmount > 0 && (
        <Row left={`Service (${formatPercent(order.serviceBp)})`} right={formatRupiah(order.serviceAmount)} />
      )}
      {order.taxAmount > 0 && <Row left={`Pajak (${formatPercent(order.taxBp)})`} right={formatRupiah(order.taxAmount)} />}
      {order.roundingAmount !== 0 && <Row left="Pembulatan" right={formatRupiah(order.roundingAmount)} />}
      <Row left="TOTAL" right={formatRupiah(order.total)} bold />

      <Divider />
      {order.payments.length === 0 ? (
        <p className="text-center font-bold">{order.status === 'CANCELLED' ? 'DIBATALKAN' : 'BELUM DIBAYAR'}</p>
      ) : (
        <>
          {order.payments.map((p) => (
            <div key={p.id} className="mb-1">
              <Row left={paymentMethodLabel[p.method]} right={formatRupiah(p.amount)} />
              {p.method === 'CASH' && p.tendered != null && (
                <div className="pl-2">
                  <Row left="Diterima" right={formatRupiah(p.tendered)} />
                  <Row left="Kembali" right={formatRupiah(p.changeAmount ?? 0)} />
                </div>
              )}
              {p.reference && <div className="pl-2">Ref: {p.reference}</div>}
            </div>
          ))}

          {order.refunds.length > 0 && (
            <div className="mt-1">
              {order.refunds.map((r) => (
                <Row key={r.id} left="Refund" right={`-${formatRupiah(r.amount)}`} />
              ))}
              <Row left="Dibayar bersih" right={formatRupiah(paid - refunded)} bold />
            </div>
          )}

          {order.status === 'CANCELLED' ? (
            <p className="mt-1 text-center font-bold">DIBATALKAN</p>
          ) : order.refunds.length > 0 ? (
            <p className="mt-1 text-center font-bold">{paid - refunded <= 0 ? 'REFUND PENUH' : 'REFUND SEBAGIAN'}</p>
          ) : balance > 0 ? (
            <Row left="SISA TAGIHAN" right={formatRupiah(balance)} bold />
          ) : (
            <p className="mt-1 text-center font-bold">LUNAS</p>
          )}
        </>
      )}

      <Divider />
      <p className="text-center">{config?.receiptFooter ?? 'Terima kasih'}</p>
    </div>
  )
}