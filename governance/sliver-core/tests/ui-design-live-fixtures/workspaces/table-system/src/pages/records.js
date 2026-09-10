import { StableDataTable } from "../components/StableDataTable.js";
import { Card } from "../components/ui/Card.js";

document.querySelector("#app").innerHTML = `<h1>Operational records</h1>${Card(StableDataTable([
  { id: "REC-101", status: "Ready" },
  { id: "REC-102", status: "Review" },
]))}`;
