import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { Customer, Product, Sale } from '@tienda/shared';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint base de sincronización (Push & Pull)
app.post('/api/sync', (req: Request, res: Response) => {
  const { client_timestamp, customers, products, sales } = req.body;
  
  // Respuesta temporal de contrato mientras se conecta la BD
  res.json({
    success: true,
    server_timestamp: new Date().toISOString(),
    processed_counts: {
      customers: (customers?.created?.length || 0) + (customers?.updated?.length || 0),
      products: (products?.created?.length || 0) + (products?.updated?.length || 0),
      sales: (sales?.created?.length || 0) + (sales?.updated?.length || 0),
    },
    pull_delta: {
      customers: [],
      products: [],
      sales: [],
      sale_items: [],
      debts: [],
      payments: [],
      supplier_bills: [],
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});
