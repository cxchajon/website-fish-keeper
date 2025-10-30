(function (global) {
  const Chart = global?.Chart;
  if (!Chart || typeof Chart.register !== 'function') {
    return;
  }

  const DEFAULTS = {
    display: true,
    offset: 12,
    xOffset: 0,
    minSpacing: 6,
    boundaryPadding: 8,
    color: '#f8fafc',
    textAlign: 'center',
    alternate: false,
    position: 'above',
    formatter: null,
    font: { size: 11, weight: '600' },
    textStrokeColor: 'rgba(6, 11, 22, 0.85)',
    textStrokeWidth: 0,
    shadowColor: 'transparent',
    shadowBlur: 0
  };

  const plugin = {
    id: 'datalabels',
    defaults: DEFAULTS,
    afterDatasetsDraw(chart, args, pluginOptions) {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      if (!ctx || !chartArea) {
        return;
      }

      const globalOptions = mergeOptions(DEFAULTS, pluginOptions);
      const datasets = chart.data?.datasets || [];

      datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || meta.hidden) {
          return;
        }

        const elements = meta.data || [];
        if (!elements.length) {
          return;
        }

        const datasetOptions = mergeOptions(globalOptions, dataset.datalabels);
        if (!datasetOptions.display) {
          return;
        }

        const labels = getDatasetLabels(dataset, chart);
        if (!labels.length) {
          return;
        }

        const fontFamily = Chart.defaults?.font?.family || 'Inter, "Segoe UI", system-ui, sans-serif';
        const placements = [];

        elements.forEach((element, dataIndex) => {
          if (!element || typeof element.x !== 'number' || typeof element.y !== 'number') {
            return;
          }

          const context = createContext({ chart, dataset, meta, element, datasetIndex, dataIndex });
          const text = getLabelText(labels, datasetOptions, context);
          if (!text) {
            return;
          }

          const font = resolveFont(datasetOptions.font, context, fontFamily);
          const color = resolve(datasetOptions.color, context);
          const textAlign = resolve(datasetOptions.textAlign, context) || 'center';
          const offset = Math.max(resolve(datasetOptions.offset, context) || 0, 0);
          const xOffset = resolve(datasetOptions.xOffset, context) || 0;
          const boundaryPadding = Math.max(resolve(datasetOptions.boundaryPadding, context) || 0, 0);
          const minSpacing = Math.max(resolve(datasetOptions.minSpacing, context) || 0, 0);
          const alternate = Boolean(resolve(datasetOptions.alternate, context));
          const position = resolve(datasetOptions.position, context) || 'above';
          const shadowColor = resolve(datasetOptions.shadowColor, context) || 'transparent';
          const shadowBlur = Math.max(resolve(datasetOptions.shadowBlur, context) || 0, 0);
          const strokeColor = resolve(datasetOptions.textStrokeColor, context) || null;
          const strokeWidth = Math.max(resolve(datasetOptions.textStrokeWidth, context) || 0, 0);

          ctx.font = font.string;
          const textWidth = ctx.measureText(text).width;
          const lineHeight = font.size * 1.35;

          let x = element.x + xOffset;
          let y = element.y;

          if (position === 'below') {
            y = element.y + offset;
          } else if (position === 'auto') {
            y = element.y + (alternate && dataIndex % 2 === 1 ? offset * 0.85 : -offset);
          } else {
            y = element.y - offset;
          }

          x = clampXForAlign({ x, width: textWidth, chartArea, boundaryPadding, textAlign });

          const resolved = fitLabelWithinChart({
            x,
            y,
            width: textWidth,
            height: lineHeight,
            chartArea,
            placements,
            boundaryPadding,
            minSpacing,
            offset,
            elementY: element.y,
            textAlign
          });

          const drawX = resolved.x;
          const drawY = resolved.y;

          ctx.save();
          ctx.font = font.string;
          ctx.textAlign = textAlign || 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = color || '#ffffff';
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = shadowBlur;

          if (strokeWidth > 0 && strokeColor) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = strokeColor;
            ctx.strokeText(text, drawX, drawY);
          }

          ctx.fillText(text, drawX, drawY);
          ctx.restore();

          placements.push(
            getBoundingBox({
              x: drawX,
              y: drawY,
              width: textWidth,
              height: lineHeight,
              textAlign
            })
          );
        });
      });

    }
  };

  Chart.register(plugin);
  Chart.defaults.plugins = Chart.defaults.plugins || {};
  Chart.defaults.plugins.datalabels = Chart.defaults.plugins.datalabels || DEFAULTS;

  if (typeof global.ChartDataLabels === 'undefined') {
    global.ChartDataLabels = plugin;
  }

  function createContext({ chart, dataset, meta, element, datasetIndex, dataIndex }) {
    return {
      chart,
      dataset,
      element,
      datasetIndex,
      dataIndex,
      meta,
      value: dataset.data?.[dataIndex]
    };
  }

  function getDatasetLabels(dataset, chart) {
    if (Array.isArray(dataset.pointLabels)) {
      return dataset.pointLabels;
    }
    const labels = chart.data?.labels;
    return Array.isArray(labels) ? labels : [];
  }

  function getLabelText(labels, options, context) {
    const formatter = options.formatter;
    if (typeof formatter === 'function') {
      const formatted = formatter(context.value, context);
      if (formatted === null || formatted === undefined || formatted === '') {
        return '';
      }
      return String(formatted);
    }
    const label = labels[context.dataIndex];
    if (label === null || label === undefined) {
      return '';
    }
    return String(label);
  }

  function resolveFont(font, context, fallbackFamily) {
    const resolved = mergeOptions({ size: 11, weight: '600', family: fallbackFamily }, resolve(font, context));
    const size = Math.max(Number.parseFloat(resolved.size) || 11, 6);
    const weight = resolved.weight || '600';
    const family = resolved.family || fallbackFamily;
    return {
      family,
      size,
      string: `${weight} ${size}px ${family}`
    };
  }

  function resolve(value, context) {
    if (typeof value === 'function') {
      return value(context);
    }
    return value;
  }

  function mergeOptions(base, overrides) {
    const target = { ...(base || {}) };
    if (!overrides || typeof overrides !== 'object') {
      return target;
    }
    Object.keys(overrides).forEach((key) => {
      const value = overrides[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = mergeOptions(target[key] || {}, value);
      } else {
        target[key] = value;
      }
    });
    return target;
  }

  function fitLabelWithinChart({
    x,
    y,
    width,
    height,
    chartArea,
    placements,
    boundaryPadding,
    minSpacing,
    offset,
    elementY,
    textAlign
  }) {
    const maxAttempts = 12;
    const step = height + minSpacing;
    let attempt = 0;
    let direction = y < elementY ? -1 : 1;
    if (!direction) {
      direction = -1;
    }

    let candidateX = clamp(x, chartArea.left + boundaryPadding, chartArea.right - boundaryPadding);
    let candidateY = y;

    while (attempt < maxAttempts) {
      const bounds = getBoundingBox({ x: candidateX, y: candidateY, width, height, textAlign });
      const inside =
        bounds.left >= chartArea.left + boundaryPadding &&
        bounds.right <= chartArea.right - boundaryPadding &&
        bounds.top >= chartArea.top + boundaryPadding &&
        bounds.bottom <= chartArea.bottom - boundaryPadding;

      const overlaps = placements.some((placed) => boxesOverlap(bounds, placed));

      if (inside && !overlaps) {
        return { x: candidateX, y: candidateY };
      }

      candidateY += direction * step;
      direction *= -1;
      attempt += 1;
    }

    return {
      x: candidateX,
      y: clamp(candidateY, chartArea.top + boundaryPadding + height / 2, chartArea.bottom - boundaryPadding - height / 2)
    };
  }

  function getBoundingBox({ x, y, width, height, textAlign }) {
    let left = x - width / 2;
    let right = x + width / 2;
    if (textAlign === 'left') {
      left = x;
      right = x + width;
    } else if (textAlign === 'right') {
      left = x - width;
      right = x;
    }
    return {
      left,
      right,
      top: y - height / 2,
      bottom: y + height / 2
    };
  }

  function clampXForAlign({ x, width, chartArea, boundaryPadding, textAlign }) {
    const leftBound = chartArea.left + boundaryPadding;
    const rightBound = chartArea.right - boundaryPadding;
    if (textAlign === 'left') {
      if (x < leftBound) {
        return leftBound;
      }
      if (x + width > rightBound) {
        return rightBound - width;
      }
      return x;
    }
    if (textAlign === 'right') {
      if (x - width < leftBound) {
        return leftBound + width;
      }
      if (x > rightBound) {
        return rightBound;
      }
      return x;
    }
    const half = width / 2;
    if (x - half < leftBound) {
      x = leftBound + half;
    }
    if (x + half > rightBound) {
      x = rightBound - half;
    }
    return x;
  }

  function boxesOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
