# Requirements (as stated by the developer, 2026-10-15)

## Goal
Replace the Google Form ordering flow, which leads to money miscalculation.

## Apps
| App | Purpose |
|---|---|
| `apps/client` | Public storefront where anyone can buy |
| `apps/pos` | On-site point of sale |
| `apps/dashboard` | Manage products, promotions and orders |
| `apps/server` | Backend for all three apps |

## Decisions so far
- Database: MongoDB.
- **Stores** are not tied to any project. Each store sells **products with variants**.
- Payment: the system shows a Thai QR (PromptPay) with the amount already set. The buyer uploads the slip, and the system **stores the QR payload read from the slip** for verification.
- Online orders have fields for **shipping address** and **tracking ID**.
- Users already exist in the **enrollment website**'s data. The schema hasn't been provided yet.

See [questions-for-ceo.md](questions-for-ceo.md) for open questions.
