import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Material {
  id: string;
  material_code: string;
  name: string;
  current_quantity: number;
  unit: string;
}

interface StockHistory {
  id: string;
  quantity_before: number;
  quantity_after: number;
  quantity_change: number;
  reason: string;
  notes: string | null;
  created_at: string;
  materials: {
    material_code: string;
    name: string;
    unit: string;
  } | null;
}

export default function StockUpdates() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [quantityChange, setQuantityChange] = useState<number>(0);
  const [reason, setReason] = useState<"purchase" | "production_use" | "adjustment" | "damage" | "return">("purchase");
  const [notes, setNotes] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchMaterials();
    fetchHistory();
  }, []);

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from("materials")
      .select("id, material_code, name, current_quantity, unit")
      .order("material_code");
    setMaterials(data || []);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("stock_history")
      .select(
        `
        *,
        materials:material_id (material_code, name, unit)
      `
      )
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMaterial) {
      toast({ title: "Error", description: "Please select a material", variant: "destructive" });
      return;
    }

    const material = materials.find((m) => m.id === selectedMaterial);
    if (!material) return;

    const newQuantity = material.current_quantity + quantityChange;

    if (newQuantity < 0) {
      toast({
        title: "Error",
        description: "Quantity cannot be negative",
        variant: "destructive",
      });
      return;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update material quantity
    const { error: updateError } = await supabase
      .from("materials")
      .update({ current_quantity: newQuantity })
      .eq("id", selectedMaterial);

    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
      return;
    }

    // Insert history record
    const { error: historyError } = await supabase.from("stock_history").insert([
      {
        material_id: selectedMaterial,
        user_id: user.id,
        quantity_before: material.current_quantity,
        quantity_after: newQuantity,
        quantity_change: quantityChange,
        reason,
        notes: notes || null,
      },
    ]);

    if (historyError) {
      toast({ title: "Error", description: historyError.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Stock updated successfully" });
      setSelectedMaterial("");
      setQuantityChange(0);
      setReason("purchase");
      setNotes("");
      fetchMaterials();
      fetchHistory();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Daily Stock Updates</h1>

      <Card>
        <CardHeader>
          <CardTitle>Update Stock Quantity</CardTitle>
          <CardDescription>
            Record stock changes due to purchases, production use, or adjustments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material">Material *</Label>
                <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.material_code} - {m.name} (Current: {m.current_quantity} {m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity Change *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="Use + for increase, - for decrease"
                  value={quantityChange === 0 ? "" : quantityChange}
                  onChange={(e) => setQuantityChange(parseFloat(e.target.value) || 0)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Example: +100 for purchase, -50 for production use
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Select value={reason} onValueChange={(value) => setReason(value as typeof reason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="production_use">Production Use</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="damage">Damage/Loss</SelectItem>
                    <SelectItem value="return">Return to Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes about this stock change..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <Button type="submit" className="w-full md:w-auto">
              Update Stock
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Changes</CardTitle>
          <CardDescription>Last 20 stock update records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">{record.materials?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.materials?.material_code}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          record.quantity_change > 0
                            ? "text-success font-semibold"
                            : "text-destructive font-semibold"
                        }
                      >
                        {record.quantity_change > 0 ? "+" : ""}
                        {record.quantity_change} {record.materials?.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      {record.quantity_before} {record.materials?.unit}
                    </TableCell>
                    <TableCell>
                      {record.quantity_after} {record.materials?.unit}
                    </TableCell>
                    <TableCell className="capitalize">{record.reason.replace("_", " ")}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {record.notes || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
