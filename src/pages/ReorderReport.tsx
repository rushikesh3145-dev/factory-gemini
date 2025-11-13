import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { FileDown, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReorderMaterial {
  id: string;
  material_code: string;
  name: string;
  current_quantity: number;
  reorder_point: number;
  safety_stock: number;
  unit: string;
  status: "critical" | "low" | "safe";
  shortage_date: string | null;
  avg_daily_usage: number;
  lead_time_days: number;
  suppliers: { name: string; email: string } | null;
}

export default function ReorderReport() {
  const [materials, setMaterials] = useState<ReorderMaterial[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchReorderMaterials();
  }, []);

  const fetchReorderMaterials = async () => {
    const { data, error } = await supabase
      .from("materials")
      .select(
        `
        *,
        suppliers:supplier_id (name, email)
      `
      )
      .or("status.eq.critical,status.eq.low")
      .order("status");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMaterials(data || []);
    }
  };

  const getDaysUntilShortage = (material: ReorderMaterial): number | null => {
    if (!material.shortage_date) return null;
    const days = Math.floor(
      (new Date(material.shortage_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? days : 0;
  };

  const getRecommendedOrderQty = (material: ReorderMaterial) => {
    // Formula: (Lead time × Daily usage) + Safety stock - Current quantity
    const orderQty =
      material.lead_time_days * material.avg_daily_usage +
      material.safety_stock -
      material.current_quantity;
    return Math.max(0, Math.ceil(orderQty));
  };

  const exportToPDF = () => {
    toast({
      title: "Export feature",
      description: "PDF export functionality would be implemented here",
    });
  };

  const exportToExcel = () => {
    toast({
      title: "Export feature",
      description: "Excel export functionality would be implemented here",
    });
  };

  const sendReorderEmail = (material: ReorderMaterial) => {
    toast({
      title: "Email feature",
      description: `Reorder email for ${material.name} would be sent to ${material.suppliers?.email || "supplier"}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Reorder Report</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <FileDown className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No materials need reordering at this time. All stock levels are healthy! 🎉
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Materials Requiring Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {materials.filter((m) => m.status === "critical").length} critical items and{" "}
                {materials.filter((m) => m.status === "low").length} low stock items need reordering.
              </p>
            </CardContent>
          </Card>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Current Qty</TableHead>
                  <TableHead>Reorder Point</TableHead>
                  <TableHead>Recommended Order Qty</TableHead>
                  <TableHead>Days to Shortage</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow
                    key={material.id}
                    className={material.status === "critical" ? "bg-destructive/5" : ""}
                  >
                    <TableCell>
                      <StatusBadge status={material.status} />
                    </TableCell>
                    <TableCell className="font-mono">{material.material_code}</TableCell>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>
                      {material.current_quantity} {material.unit}
                    </TableCell>
                    <TableCell>
                      {material.reorder_point} {material.unit}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {getRecommendedOrderQty(material)} {material.unit}
                    </TableCell>
                    <TableCell>
                      {getDaysUntilShortage(material) !== null ? (
                        <span
                          className={
                            getDaysUntilShortage(material)! <= material.lead_time_days
                              ? "text-destructive font-semibold"
                              : ""
                          }
                        >
                          {getDaysUntilShortage(material)} days
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>{material.suppliers?.name || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendReorderEmail(material)}
                        disabled={!material.suppliers?.email}
                      >
                        <Mail className="h-3 w-3 mr-2" />
                        Send Email
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
