-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'operator');

-- Create enum for stock status
CREATE TYPE public.stock_status AS ENUM ('critical', 'low', 'safe');

-- Create enum for update reason
CREATE TYPE public.update_reason AS ENUM ('purchase', 'production_use', 'adjustment', 'damage', 'return');

-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  rating NUMERIC DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create materials table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  unit TEXT NOT NULL,
  current_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  safety_stock NUMERIC NOT NULL DEFAULT 0,
  avg_daily_usage NUMERIC DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  status public.stock_status NOT NULL DEFAULT 'safe',
  shortage_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create stock_history table
CREATE TABLE public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  quantity_change NUMERIC NOT NULL,
  reason public.update_reason NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for warehouses (all authenticated users can read, only admin can write)
CREATE POLICY "Authenticated users can view warehouses"
  ON public.warehouses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert warehouses"
  ON public.warehouses FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update warehouses"
  ON public.warehouses FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete warehouses"
  ON public.warehouses FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for suppliers (all authenticated users can read, admin/manager can write)
CREATE POLICY "Authenticated users can view suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can insert suppliers"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update suppliers"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete suppliers"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for materials (all authenticated users can read, operators+ can update quantities)
CREATE POLICY "Authenticated users can view materials"
  ON public.materials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can insert materials"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "All authenticated users can update materials"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete materials"
  ON public.materials FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Authenticated users can view their own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for stock_history (all can read, all can insert)
CREATE POLICY "Authenticated users can view stock history"
  ON public.stock_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert stock history"
  ON public.stock_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create function to update material status based on quantity
CREATE OR REPLACE FUNCTION public.update_material_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate shortage date if avg_daily_usage > 0
  IF NEW.avg_daily_usage > 0 THEN
    NEW.shortage_date = NOW() + (NEW.current_quantity / NEW.avg_daily_usage || ' days')::INTERVAL;
  ELSE
    NEW.shortage_date = NULL;
  END IF;

  -- Update status based on quantity levels
  IF NEW.current_quantity <= NEW.safety_stock THEN
    NEW.status = 'critical';
  ELSIF NEW.current_quantity <= NEW.reorder_point THEN
    NEW.status = 'low';
  ELSE
    NEW.status = 'safe';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update material status
CREATE TRIGGER update_material_status_trigger
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_material_status();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.warehouses (name, location, capacity) VALUES
  ('Main Warehouse', 'Building A, Floor 1', 10000),
  ('Secondary Storage', 'Building B, Floor 2', 5000),
  ('Cold Storage', 'Building C', 2000);

INSERT INTO public.suppliers (name, contact_person, email, phone, address, rating) VALUES
  ('Steel Corp Ltd', 'John Smith', 'john@steelcorp.com', '+1-555-0101', '123 Industrial Ave', 4.5),
  ('Plastic Industries', 'Sarah Johnson', 'sarah@plastic-ind.com', '+1-555-0102', '456 Manufacturing St', 4.8),
  ('Chemical Supplies Inc', 'Mike Brown', 'mike@chemsupply.com', '+1-555-0103', '789 Chemical Rd', 4.2),
  ('Electronics Wholesale', 'Lisa Chen', 'lisa@elec-whole.com', '+1-555-0104', '321 Tech Park', 4.9),
  ('Packaging Solutions', 'David Lee', 'david@packsol.com', '+1-555-0105', '654 Box Lane', 4.6);

INSERT INTO public.materials (material_code, name, supplier_id, warehouse_id, unit, current_quantity, reorder_point, safety_stock, avg_daily_usage, lead_time_days) VALUES
  ('STL-001', 'Cold Rolled Steel Sheet', (SELECT id FROM public.suppliers WHERE name = 'Steel Corp Ltd'), (SELECT id FROM public.warehouses WHERE name = 'Main Warehouse'), 'kg', 450, 500, 200, 50, 7),
  ('PLS-002', 'ABS Plastic Pellets', (SELECT id FROM public.suppliers WHERE name = 'Plastic Industries'), (SELECT id FROM public.warehouses WHERE name = 'Main Warehouse'), 'kg', 180, 300, 150, 45, 5),
  ('CHM-003', 'Industrial Adhesive', (SELECT id FROM public.suppliers WHERE name = 'Chemical Supplies Inc'), (SELECT id FROM public.warehouses WHERE name = 'Main Warehouse'), 'liters', 85, 150, 75, 25, 10),
  ('ELC-004', 'Circuit Boards', (SELECT id FROM public.suppliers WHERE name = 'Electronics Wholesale'), (SELECT id FROM public.warehouses WHERE name = 'Secondary Storage'), 'pcs', 1200, 500, 200, 80, 14),
  ('PKG-005', 'Corrugated Boxes', (SELECT id FROM public.suppliers WHERE name = 'Packaging Solutions'), (SELECT id FROM public.warehouses WHERE name = 'Secondary Storage'), 'pcs', 2800, 1000, 500, 150, 3),
  ('STL-006', 'Stainless Steel Rods', (SELECT id FROM public.suppliers WHERE name = 'Steel Corp Ltd'), (SELECT id FROM public.warehouses WHERE name = 'Main Warehouse'), 'pcs', 320, 400, 150, 60, 7),
  ('PLS-007', 'Polycarbonate Sheets', (SELECT id FROM public.suppliers WHERE name = 'Plastic Industries'), (SELECT id FROM public.warehouses WHERE name = 'Main Warehouse'), 'sheets', 95, 200, 100, 35, 5),
  ('CHM-008', 'Paint Coating', (SELECT id FROM public.suppliers WHERE name = 'Chemical Supplies Inc'), (SELECT id FROM public.warehouses WHERE name = 'Main Warehouse'), 'liters', 240, 300, 120, 40, 10);
