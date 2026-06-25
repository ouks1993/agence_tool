import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { formatDate, formatMoney } from "@/lib/format";

/** Flat, render-ready shape so route handlers stay decoupled from the DB schema. */
export type ProposalPdfData = {
  reference: string;
  title: string;
  clientName: string | null;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  paxCount: number;
  summary: string | null;
  currency: string;
  totalPrice: number;
  validUntil: Date | null;
  acceptedAt: Date | null;
  signerName: string | null;
  items: {
    id: string;
    title: string;
    typeLabel: string;
    description: string | null;
    linePrice: number;
    currency: string;
  }[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#18181b", fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 12,
    marginBottom: 16,
  },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  tagline: { fontSize: 9, color: "#71717a" },
  ref: { fontSize: 9, color: "#71717a", textAlign: "right" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { fontSize: 9, color: "#71717a", marginBottom: 12 },
  summary: {
    fontSize: 10,
    lineHeight: 1.5,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e4e4e7",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  itemTitle: { fontFamily: "Helvetica-Bold" },
  itemSub: { fontSize: 8, color: "#71717a", marginTop: 2 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    paddingTop: 10,
    marginTop: 8,
  },
  totalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  accepted: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 4,
    color: "#15803d",
    fontSize: 9,
  },
  footer: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    fontSize: 8,
    color: "#a1a1aa",
  },
});

function ProposalDocument({ data }: { data: ProposalPdfData }) {
  const metaParts = [
    data.clientName ? `Prepared for ${data.clientName}` : null,
    data.destination,
    data.startDate || data.endDate
      ? `${formatDate(data.startDate)} - ${formatDate(data.endDate)}`
      : null,
    `${data.paxCount} traveller${data.paxCount === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <Document title={`Proposal ${data.reference}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{APP_NAME}</Text>
            <Text style={styles.tagline}>{APP_TAGLINE}</Text>
          </View>
          <View>
            <Text style={styles.ref}>{data.reference}</Text>
            <Text style={styles.ref}>{formatDate(new Date())}</Text>
          </View>
        </View>

        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.meta}>{metaParts.join("  -  ")}</Text>

        {data.summary ? <Text style={styles.summary}>{data.summary}</Text> : null}

        <Text style={styles.sectionTitle}>What&apos;s included</Text>
        {data.items.length === 0 ? (
          <Text style={styles.itemSub}>No items yet.</Text>
        ) : (
          data.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSub}>
                  {item.typeLabel}
                  {item.description ? ` - ${item.description}` : ""}
                </Text>
              </View>
              <Text>{formatMoney(item.linePrice, item.currency)}</Text>
            </View>
          ))
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatMoney(data.totalPrice, data.currency)}
          </Text>
        </View>

        {data.acceptedAt ? (
          <Text style={styles.accepted}>
            Accepted{data.signerName ? ` by ${data.signerName}` : ""} on{" "}
            {formatDate(data.acceptedAt)}.
          </Text>
        ) : null}

        <Text style={styles.footer}>
          {data.validUntil
            ? `This proposal is valid until ${formatDate(data.validUntil)}. `
            : ""}
          Prepared by {APP_NAME} - {APP_TAGLINE}. Prices are per the package and
          subject to availability at the time of booking.
        </Text>
      </Page>
    </Document>
  );
}

/** Renders the proposal to a PDF buffer (Node runtime only — no headless browser). */
export function renderProposalPdf(data: ProposalPdfData): Promise<Buffer> {
  return renderToBuffer(<ProposalDocument data={data} />);
}
