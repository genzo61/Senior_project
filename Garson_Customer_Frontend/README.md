# Customer Mobile Web Flow (QR -> Menu -> AI -> Cart -> Checkout)

This frontend implements a QR-based customer ordering flow without changing robot runtime, ROS2, or admin/kitchen apps.

## New flow

1. Customer scans QR and lands on `/q/:token`.
2. Table context is resolved and validated via backend tables API.
3. Customer opens `/menu?table=<id>`, browses products, and can chat with AI assistant.
4. AI can suggest menu items or generate cart updates (add/remove + quantity + special note parsing).
5. Real order is created only when customer confirms checkout.
6. After checkout, customer sees `/order/:orderId` status screen.

## Routes

- `/q/:token` : QR entry + table validation
- `/menu?table=4` : main mobile ordering page
- `/order/:orderId?table=4` : order success/status page
- `/masa/:id` : legacy redirect to `/menu?table=:id`

## APIs currently used

- `GET /api/products`
- `GET /api/tables`
- `POST /api/orders`
- `GET /api/orders/{id}`

## Run

```bash
cd Garson_Customer_Frontend
npm run dev
```

Optional env vars:

- `VITE_BACKEND_URL` (default: `http://<host>:8085`)
- `VITE_AI_CHAT_ENDPOINT` (optional; if absent/unreachable, frontend mock parser is used)

## Backend TODOs (for production parity)

- Add product metadata fields in backend response: `category`, `description`, `tags`, optional modifiers/variants.
- Add order item note support in backend model (e.g. `OrderItem.specialNote`) so AI/manual notes persist to kitchen.
- Add dedicated AI endpoint contract for structured response:
  - `intent`
  - `items[]` (`product_id`, `quantity`, `special_note`, `operation`)
  - `assistant_message`
  - `suggested_products[]`
- Add optional endpoint to validate QR token server-side (instead of frontend token parsing).

## Notes

- AI never finalizes orders directly.
- AI only updates cart draft; checkout is explicit user action.
- AI product matching is restricted to real menu items loaded from backend.
