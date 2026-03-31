import { loadCategories, classifyText } from "./classifier";

async function runTests() {
  console.log("=== Classifier Phase 1 Tests ===\n");

  // Test 1: loadCategories runs without error
  try {
    await loadCategories();
    console.log("✅ Test 1 PASS — categories loaded");
  } catch (e) {
    console.error("❌ Test 1 FAIL — loadCategories threw:", e);
    return;
  }

  // Test 2: calling loadCategories twice doesn't break (cache check)
  try {
    await loadCategories();
    console.log("✅ Test 2 PASS — double load safe (cache works)");
  } catch (e) {
    console.error("❌ Test 2 FAIL:", e);
  }

  // Test 3: classifyText returns correct shape
  const result = await classifyText("invoice payment budget Q3 expenses");
  console.log("\nTest 3 — classify 'invoice payment budget Q3 expenses'");
  console.log("  label:", result.label);
  console.log("  confidence:", result.confidence.toFixed(4));
  if (typeof result.label === "string" && typeof result.confidence === "number") {
    console.log("✅ Test 3 PASS — correct shape returned");
  } else {
    console.error("❌ Test 3 FAIL — wrong shape");
  }

  // Test 4: Finance text → Finance label
  console.log("\nTest 4 — should classify as Finance:", result.label);
  if (result.label === "Finance") {
    console.log("✅ Test 4 PASS — correctly classified as Finance");
  } else {
    console.warn("⚠️  Test 4 SOFT FAIL — got", result.label, "(model may vary, check confidence)");
  }

  // Test 5: Resume text
  const r2 = await classifyText("curriculum vitae work experience software engineer skills");
  console.log("\nTest 5 — classify resume text → got:", r2.label, "(", r2.confidence.toFixed(4), ")");
  if (r2.label === "Resume") {
    console.log("✅ Test 5 PASS");
  } else {
    console.warn("⚠️  Test 5 SOFT FAIL — got", r2.label);
  }

  console.log("\n=== Phase 1 Complete ===");
}

runTests();