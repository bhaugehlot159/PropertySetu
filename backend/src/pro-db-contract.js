import {
  buildCoreDatabaseContract
} from "../../server/v3/contracts/coreDatabaseContract.js";
import CoreUser from "../../server/v3/models/CoreUser.js";
import CoreProperty from "../../server/v3/models/CoreProperty.js";
import CoreReview from "../../server/v3/models/CoreReview.js";
import CoreSubscription from "../../server/v3/models/CoreSubscription.js";

function fieldCoverage(model, requiredFields = []) {
  const schemaPaths = model?.schema?.paths
    ? Object.keys(model.schema.paths)
    : [];

  const present = requiredFields.filter((field) => schemaPaths.includes(field));
  const missing = requiredFields.filter((field) => !schemaPaths.includes(field));

  return {
    present,
    missing,
    coveragePercent: requiredFields.length
      ? Math.round((present.length / requiredFields.length) * 100)
      : 100
  };
}

const contract = buildCoreDatabaseContract({ dbConnected: false });
const checks = {
  users: fieldCoverage(CoreUser, contract.collections.users.requiredFields),
  properties: fieldCoverage(CoreProperty, contract.collections.properties.requiredFields),
  reviews: fieldCoverage(CoreReview, contract.collections.reviews.requiredFields),
  subscriptions: fieldCoverage(
    CoreSubscription,
    contract.collections.subscriptions.requiredFields
  )
};

console.log("PropertySetu MongoDB Contract Check");
console.log(`Version: ${contract.version}`);
console.log("");

let totalMissing = 0;
Object.entries(checks).forEach(([name, details]) => {
  const label = name[0].toUpperCase() + name.slice(1);
  console.log(`${label}: ${details.coveragePercent}%`);
  console.log(`  Present: ${details.present.join(", ") || "-"}`);
  console.log(`  Missing: ${details.missing.join(", ") || "None"}`);
  totalMissing += details.missing.length;
  console.log("");
});

if (totalMissing > 0) {
  console.log(`Result: FAIL (${totalMissing} required fields missing).`);
  process.exitCode = 1;
} else {
  console.log("Result: PASS (all requested MongoDB structure fields are aligned).");
}
