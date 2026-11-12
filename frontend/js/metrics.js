import { setText } from './ui.js';

function renderMetrics(metrics) {
  const models = [metrics.knn, metrics.mlp];
  const names = ['KNN', 'MLP'];
  const primary = metrics.primary_model === 'mlp' ? 1 : 0;
  const primaryTest = models[primary].test;
  const metricCards = document.querySelectorAll('#metrik-model .metric-stat-box .metric-val');
  const cardValues = [primaryTest.recall, primaryTest.accuracy, primaryTest.roc_auc, primaryTest.f1];
  metricCards.forEach((node, index) => {
    if (cardValues[index] != null) node.textContent = index === 2 ? cardValues[index].toFixed(3) : `${(cardValues[index] * 100).toFixed(1)}%`;
  });
  document.querySelectorAll('#metrik-model .metric-stat-box .metric-winner-tag').forEach((node, index) => {
    node.textContent = `Model utama ${names[primary]} · data uji`;
  });
  const headers = document.querySelectorAll('#metrik-model .data-table thead th');
  if (headers[1]) headers[1].textContent = `KNN (k=${metrics.knn.best_k})`;
  if (headers[2]) headers[2].textContent = `MLP (${metrics.mlp.hidden_layers.join(', ')})`;

  const rows = document.querySelectorAll('#metrik-model .data-table tbody tr');
  const keys = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc'];
  rows.forEach((row, index) => {
    const key = keys[index];
    if (!key) return;
    [0, 1].forEach((modelIndex) => {
      const cell = row.cells[modelIndex + 1];
      if (cell) cell.textContent = key === 'roc_auc' ? models[modelIndex].test[key].toFixed(3) : `${(models[modelIndex].test[key] * 100).toFixed(1)}%`;
    });
  });
  const matrix = primaryTest.confusion_matrix;
  const matrixValues = [matrix.tn, matrix.fp, matrix.fn, matrix.tp];
  document.querySelectorAll('#metrik-model .cm-cell strong').forEach((node, index) => {
    if (matrixValues[index] != null) node.textContent = matrixValues[index];
  });
  setText('#metrik-model .section-description', `Kinerja model pada data uji (N=${metrics.n_test}) dari ${metrics.n_train + metrics.n_test} data; model utama ${names[primary]}.`);
  const cmHeading = document.querySelector('#metrik-model .confusion-matrix-table')?.previousElementSibling?.querySelector('.card-title');
  if (cmHeading) cmHeading.textContent = `Confusion Matrix ${names[primary]} (N=${metrics.n_test})`;
  const modelNote = document.querySelector('#metrik-model .content-grid-2col .card > div:last-child');
  if (modelNote) modelNote.textContent = `* Model utama: ${names[primary]}. Metrik dihitung dari data uji pada dataset backend.`;
  const confusionNote = document.querySelector('#metrik-model .confusion-matrix-table + div');
  if (confusionNote) confusionNote.textContent = `TN ${matrix.tn} · FP ${matrix.fp} · FN ${matrix.fn} · TP ${matrix.tp} pada data uji.`;
}


export { renderMetrics };

