# dApp Store Registry

Drain dApp Store Registry is self explanatory name. It contains
the dApp Store registry and a helper class to search, filter & list dApps

# Usage

## Installation

Install using NPM as `npm install @outlookdrain177/dapp-store-registry-drain` or using YARN as
`yarn add @outlookdrain177/dapp-store-registry-drain`

## Usage

### Basic

```typescript
// Import
import { DappStoreRegistry } from "@outlookdrain177/dapp-store-registry-drain";

// Instantiate a registry.
const registry = new DappStoreRegistry();
await registry.init();

// Find all the dApps
const dApps = await registry.dApps();

// Search dApps with query string "nft"
const dAppsResult = registry.search("nft");
```
