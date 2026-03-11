import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestsDir = path.join(root, 'specification/ui/manifests');
const baselinePath = path.join(root, 'specification/ui/baselines/ui-conformance-baseline.json');
const waiversPath = path.join(root, 'specification/ui/baselines/ui-conformance-waivers.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadManifests() {
  const manifests = new Map();
  const manifestFiles = fs
    .readdirSync(manifestsDir)
    .filter((file) => file.endsWith('.ui-manifest.json'))
    .sort();

  for (const file of manifestFiles) {
    const manifest = readJson(path.join(manifestsDir, file));
    manifests.set(manifest.screenId, manifest);
  }

  return manifests;
}

function collectErrors({
  manifests,
  baseline,
  waivers,
}) {
  const errors = [];
  const warnings = [];

  if (waivers.uiContract !== baseline.uiContract) {
    errors.push(
      `uiContract mismatch: baseline=${baseline.uiContract}, waivers=${waivers.uiContract}`,
    );
  }

  const scenarioIds = new Set();
  const coveredStates = new Set();
  for (const scenario of baseline.scenarios) {
    if (scenarioIds.has(scenario.id)) {
      errors.push(`Duplicate baseline scenario id: ${scenario.id}`);
    }
    scenarioIds.add(scenario.id);

    const manifest = manifests.get(scenario.screenId);
    if (!manifest) {
      errors.push(
        `Scenario references unknown screenId: scenario=${scenario.id}, screenId=${scenario.screenId}`,
      );
      continue;
    }

    if (!manifest.states.includes(scenario.state)) {
      errors.push(
        `Scenario references unknown state: scenario=${scenario.id}, screenId=${scenario.screenId}, state=${scenario.state}`,
      );
      continue;
    }

    coveredStates.add(`${scenario.screenId}::${scenario.state}`);
  }

  const waiverKeys = new Set();
  const waivedStates = new Set();
  for (const waiver of waivers.waivers) {
    const key = `${waiver.screenId}::${waiver.state}`;

    if (waiverKeys.has(key)) {
      errors.push(`Duplicate waiver entry: ${key}`);
      continue;
    }
    waiverKeys.add(key);

    const manifest = manifests.get(waiver.screenId);
    if (!manifest) {
      errors.push(`Waiver references unknown screenId: ${waiver.screenId}`);
      continue;
    }
    if (!manifest.states.includes(waiver.state)) {
      errors.push(`Waiver references unknown state: ${key}`);
      continue;
    }
    if (!waiver.reason?.trim()) {
      errors.push(`Waiver missing reason: ${key}`);
      continue;
    }

    if (coveredStates.has(key)) {
      warnings.push(`Stale waiver (state now covered by a scenario): ${key}`);
    }

    waivedStates.add(key);
  }

  const missingStates = [];
  for (const manifest of manifests.values()) {
    for (const state of manifest.states) {
      const key = `${manifest.screenId}::${state}`;
      if (!coveredStates.has(key) && !waivedStates.has(key)) {
        missingStates.push(key);
      }
    }
  }

  if (missingStates.length > 0) {
    errors.push(
      [
        'Missing required screen-state coverage (add baseline scenario or explicit waiver):',
        ...missingStates.map((key) => `  - ${key}`),
      ].join('\n'),
    );
  }

  return {
    errors,
    warnings,
    totals: {
      manifestStates: [...manifests.values()].reduce((sum, manifest) => sum + manifest.states.length, 0),
      coveredStates: coveredStates.size,
      waivedStates: waivedStates.size,
      scenarios: baseline.scenarios.length,
    },
  };
}

function main() {
  const manifests = loadManifests();
  const baseline = readJson(baselinePath);
  const waivers = readJson(waiversPath);

  const result = collectErrors({ manifests, baseline, waivers });

  for (const warning of result.warnings) {
    console.warn(`WARN: ${warning}`);
  }

  if (result.errors.length > 0) {
    console.error('UI conformance coverage validation failed.');
    for (const error of result.errors) {
      console.error(`ERROR: ${error}`);
    }
    process.exit(1);
  }

  console.log('UI conformance coverage validation passed.');
  console.log(
    [
      `manifestStates=${result.totals.manifestStates}`,
      `coveredStates=${result.totals.coveredStates}`,
      `waivedStates=${result.totals.waivedStates}`,
      `scenarios=${result.totals.scenarios}`,
    ].join(' '),
  );
}

main();
