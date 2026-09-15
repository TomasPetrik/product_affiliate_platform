import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import { ConfirmFormButton } from "@/components/admin/confirm-form-button";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { deleteRetailerOfferAction, refreshEbayOfferAction } from "@/server/actions/retailer-offer.actions";
import { offerStatusLabel, type AdminRetailerOffer } from "@/server/services/retailer-offer.service";

interface RetailerOffersPanelProps {
  productId: string;
  offers: AdminRetailerOffer[];
}

export function RetailerOffersPanel({ productId, offers }: RetailerOffersPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Retailer offers</CardTitle>
        <Button
          nativeButton={false}
          size="sm"
          render={<Link href={`/admin/products/${productId}/offers/ebay`} />}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add eBay offer
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">
          Offers are per retailer listing. Amazon, Walmart, and others can be added later without changing the
          product itself.
        </p>
        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No retailer offers yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Retailer</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell>
                    <p className="font-medium">{offer.marketplaceName}</p>
                    <p className="text-xs text-muted-foreground">{offer.externalProductId}</p>
                  </TableCell>
                  <TableCell>
                    {offer.price != null && offer.currency ? formatCurrency(offer.price, offer.currency) : "—"}
                  </TableCell>
                  <TableCell>{offerStatusLabel(offer)}</TableCell>
                  <TableCell>{formatRelativeTime(offer.lastSyncedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                        render={<Link href={`/admin/products/${productId}/offers/${offer.id}/edit`} />}
                      >
                        Edit
                      </Button>
                      {offer.marketplaceCode === "EBAY" ? (
                        <ConfirmFormButton
                          action={refreshEbayOfferAction}
                          fields={{ offerId: offer.id, productId }}
                          title="Refresh eBay offer?"
                          description="This re-fetches price, availability, and the affiliate URL from eBay. RadarCut product copy is left unchanged."
                          confirmLabel="Refresh"
                          trigger={
                            <Button type="button" size="sm" variant="outline" className="gap-1">
                              <RefreshCw className="h-3.5 w-3.5" />
                              Refresh
                            </Button>
                          }
                        />
                      ) : null}
                      <DeleteEntityButton
                        action={deleteRetailerOfferAction}
                        hiddenFieldName="offerId"
                        hiddenFieldValue={offer.id}
                        entityLabel={`${offer.marketplaceName} offer`}
                        extraFields={{ productId }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
