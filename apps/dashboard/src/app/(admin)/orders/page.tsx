"use client";

import type { OrderStatus, PaymentStatus, Purchase } from "@merch/shared";
import { Button, Price, Select } from "@merch/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useOrderCount } from "@/components/OrderCountProvider";
import { listOrders } from "@/lib/api";
import {
  formatBangkokDateTime,
  formatBuyerSummary,
  mapOrderError,
  orderItemCount,
  orderTotal,
  shortOrderId,
} from "@/lib/orders";
import { COPY, formatOrderStatus, formatPaymentStatus } from "./copy";

const STATUS_OPTIONS: OrderStatus[] = ["ORDERED", "SHIPPING", "ARRIVED"];
const PAYMENT_OPTIONS: PaymentStatus[] = ["PENDING_CHECK", "VERIFIED", "REJECTED"];

function StatusLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-rigging bg-rigging/30 px-2 py-0.5 text-small font-medium text-ink">
      {text}
    </span>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { count: newOrderCount, refresh: refreshOrderCount } = useOrderCount();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "">("");
  const [page, setPage] = useState(1);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [orders, setOrders] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRedirect = useCallback(
    (path: string) => {
      router.replace(path);
    },
    [router],
  );

  useEffect(() => {
    let active = true;
    void refreshOrderCount();

    listOrders({
      status: statusFilter || undefined,
      payment_status: paymentFilter || undefined,
      page,
    })
      .then((res) => {
        if (!active) return;
        setOrders(res.orders);
        setTotal(res.total);
        setPageSize(res.page_size);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        const msg = mapOrderError(err, handleRedirect);
        if (msg) setError(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [handleRedirect, page, paymentFilter, refreshOrderCount, reloadNonce, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = statusFilter !== "" || paymentFilter !== "";

  return (
    <div className="flex flex-col gap-6">
      {/* Header with New-Order Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-h2 font-semibold text-ink">{COPY.pageTitle}</h1>
          {newOrderCount > 0 ? (
            <span
              aria-label={COPY.newOrdersBadgeLabel(newOrderCount)}
              className="inline-flex min-w-7 items-center justify-center rounded-sm bg-ink px-2 py-0.5 text-small font-semibold tabular-nums text-house"
            >
              {newOrderCount}
            </span>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:max-w-lg">
        <Select
          id="orders-status-filter"
          label={COPY.statusFilterLabel}
          value={statusFilter}
          onChange={(e) => {
            setLoading(true);
            setPage(1);
            setStatusFilter(e.target.value as OrderStatus | "");
          }}
        >
          <option value="">{COPY.filterAll}</option>
          {STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {formatOrderStatus(st)}
            </option>
          ))}
        </Select>

        <Select
          id="orders-payment-filter"
          label={COPY.paymentFilterLabel}
          value={paymentFilter}
          onChange={(e) => {
            setLoading(true);
            setPage(1);
            setPaymentFilter(e.target.value as PaymentStatus | "");
          }}
        >
          <option value="">{COPY.filterAll}</option>
          {PAYMENT_OPTIONS.map((pst) => (
            <option key={pst} value={pst}>
              {formatPaymentStatus(pst)}
            </option>
          ))}
        </Select>
      </div>

      {/* Error State */}
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-curtain bg-house p-4 text-small text-curtain"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setReloadNonce((n) => n + 1);
            }}
          >
            {COPY.retry}
          </Button>
        </div>
      ) : null}

      {/* Orders Table / Empty / Loading */}
      {loading && orders.length === 0 ? (
        <p className="text-small text-ink/70">{COPY.loading}</p>
      ) : orders.length === 0 ? (
        <p className="rounded-lg border border-rigging bg-house p-6 text-small text-ink/70">
          {hasFilters ? COPY.emptyNoMatchingOrders : COPY.emptyNoOrders}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border border-rigging bg-house">
            <table className="w-full border-collapse text-left text-small">
              <caption className="sr-only">{COPY.tableCaption}</caption>
              <thead>
                <tr className="border-b border-rigging bg-rigging/30 text-ink">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {COPY.colCreatedAt}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {COPY.colBuyer}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {COPY.colItemCount}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {COPY.colTotal}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {COPY.colPaymentStatus}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {COPY.colShippingStatus}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    {COPY.colActions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rigging">
                {orders.map((order) => {
                  const buyerText = formatBuyerSummary(order);
                  const shortId = shortOrderId(order._id);

                  return (
                    <tr key={order._id} className="bg-house hover:bg-rigging/15">
                      <td className="px-4 py-3 whitespace-nowrap text-ink">
                        <div className="flex flex-col">
                          <Link
                            href={`/orders/${order._id}`}
                            className="font-semibold text-violet underline-offset-2 hover:underline"
                          >
                            {shortId}
                          </Link>
                          <span className="text-ink/70">
                            {formatBangkokDateTime(order.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        <Link
                          href={`/orders/${order._id}`}
                          className="font-medium text-ink hover:text-violet hover:underline"
                        >
                          {buyerText}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-ink">
                        {orderItemCount(order)}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-ink">
                        <Price amount={orderTotal(order)} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel text={formatPaymentStatus(order.payment_status)} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel text={formatOrderStatus(order.status)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/orders/${order._id}`}
                          aria-label={`${COPY.viewOrder} ${shortId}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-rigging bg-house px-3 font-medium text-ink hover:bg-rigging/40"
                        >
                          {COPY.viewOrder}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-small text-ink">
            <span>{COPY.pageInfo(page, totalPages, total)}</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
              >
                {COPY.prevPage}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
              >
                {COPY.nextPage}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
