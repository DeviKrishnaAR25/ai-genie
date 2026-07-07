SCHEMA_CONTEXT = """
Dataset: intern_c_supplychain

suppliers
supplier_id INT64
supplier_name STRING
region STRING
rating FLOAT64
active BOOLEAN

warehouses
warehouse_id INT64
warehouse_name STRING
location STRING
capacity INT64

shipments
shipment_id INT64
supplier_id INT64
warehouse_id INT64
shipment_date DATE
delivery_date DATE
quantity INT64
status STRING

sla_breaches
breach_id INT64
shipment_id INT64
expected_delivery DATE
actual_delivery DATE
delay_days INT64
penalty INT64

Relationships:

shipments.supplier_id = suppliers.supplier_id

shipments.warehouse_id = warehouses.warehouse_id

sla_breaches.shipment_id = shipments.shipment_id
"""
