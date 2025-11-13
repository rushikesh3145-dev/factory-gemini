import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

interface Material {
  id: string;
  material_code: string;
  name: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  unit: string;
  current_quantity: number;
  reorder_point: number;
  safety_stock: number;
  avg_daily_usage: number;
  lead_time_days: number;
  status: "critical" | "low" | "safe";
  shortage_date: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
}

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    material_code: "",
    name: "",
    supplier_id: "",
    warehouse_id: "",
    unit: "",
    current_quantity: 0,
    reorder_point: 0,
    safety_stock: 0,
    avg_daily_usage: 0,
    lead_time_days: 7,
  });

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
    fetchWarehouses();
  }, []);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("material_code");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMaterials(data || []);
    }
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name").order("name");
    setSuppliers(data || []);
  };

  const fetchWarehouses = async () => {
    const { data } = await supabase.from("warehouses").select("id, name").order("name");
    setWarehouses(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingMaterial) {
      const { error } = await supabase
        .from("materials")
        .update(formData)
        .eq("id", editingMaterial.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Material updated successfully" });
        fetchMaterials();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("materials").insert([formData]);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Material added successfully" });
        fetchMaterials();
        resetForm();
      }
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      material_code: material.material_code,
      name: material.name,
      supplier_id: material.supplier_id || "",
      warehouse_id: material.warehouse_id || "",
      unit: material.unit,
      current_quantity: material.current_quantity,
      reorder_point: material.reorder_point,
      safety_stock: material.safety_stock,
      avg_daily_usage: material.avg_daily_usage,
      lead_time_days: material.lead_time_days,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;

    const { error } = await supabase.from("materials").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Material deleted successfully" });
      fetchMaterials();
    }
  };

  const resetForm = () => {
    setFormData({
      material_code: "",
      name: "",
      supplier_id: "",
      warehouse_id: "",
      unit: "",
      current_quantity: 0,
      reorder_point: 0,
      safety_stock: 0,
      avg_daily_usage: 0,
      lead_time_days: 7,
    });
    setEditingMaterial(null);
    setIsDialogOpen(false);
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.material_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDaysUntilShortage = (material: Material) => {
    if (!material.shortage_date) return "N/A";
    const days = Math.floor(
      (new Date(material.shortage_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? `${days} days` : "Stock out";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Materials Inventory</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Material
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMaterial ? "Edit Material" : "Add New Material"}</DialogTitle>
              <DialogDescription>
                Enter the material details below. All fields are required.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="material_code">Material Code</Label>
                  <Input
                    id="material_code"
                    value={formData.material_code}
                    onChange={(e) => setFormData({ ...formData, material_code: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouse">Warehouse</Label>
                  <Select
                    value={formData.warehouse_id}
                    onValueChange={(value) => setFormData({ ...formData, warehouse_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="kg, liters, pcs, etc."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current_quantity">Current Quantity</Label>
                  <Input
                    id="current_quantity"
                    type="number"
                    value={formData.current_quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, current_quantity: parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorder_point">Reorder Point</Label>
                  <Input
                    id="reorder_point"
                    type="number"
                    value={formData.reorder_point}
                    onChange={(e) =>
                      setFormData({ ...formData, reorder_point: parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="safety_stock">Safety Stock</Label>
                  <Input
                    id="safety_stock"
                    type="number"
                    value={formData.safety_stock}
                    onChange={(e) =>
                      setFormData({ ...formData, safety_stock: parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avg_daily_usage">Avg Daily Usage</Label>
                  <Input
                    id="avg_daily_usage"
                    type="number"
                    step="0.01"
                    value={formData.avg_daily_usage}
                    onChange={(e) =>
                      setFormData({ ...formData, avg_daily_usage: parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead_time_days">Lead Time (days)</Label>
                  <Input
                    id="lead_time_days"
                    type="number"
                    value={formData.lead_time_days}
                    onChange={(e) =>
                      setFormData({ ...formData, lead_time_days: parseInt(e.target.value) })
                    }
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">{editingMaterial ? "Update" : "Add"} Material</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by code or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Current Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Reorder Point</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Days to Shortage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMaterials.map((material) => (
              <TableRow key={material.id}>
                <TableCell className="font-mono">{material.material_code}</TableCell>
                <TableCell>{material.name}</TableCell>
                <TableCell>{material.current_quantity}</TableCell>
                <TableCell>{material.unit}</TableCell>
                <TableCell>{material.reorder_point}</TableCell>
                <TableCell>
                  <StatusBadge status={material.status} />
                </TableCell>
                <TableCell>{getDaysUntilShortage(material)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(material)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(material.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
