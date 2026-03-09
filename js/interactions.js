// --- 1. SETUP (Always runs first) ---
const totalWidth = 1200;
const totalHeight = 800;
const margin = { top: 20, right: 30, bottom: 70, left: 210 };

const chartWidth = totalWidth - margin.left - margin.right;
const chartHeight = totalHeight - margin.top - margin.bottom;

const svg = d3
  .select("#chart-container")
  .append("svg")
  .attr("width", totalWidth)
  .attr("height", totalHeight)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// --- 2. DATA LOADING (Asynchronous) ---
d3.csv("data/recent_crimes.csv").then((data) => {
  // 1. Use the ISO parser for "2026-02-22T00:00:00.000"
  const parseTime = d3.isoParse;

  data.forEach((d) => {
    d.date = parseTime(d.date); // lowercase 'date'
    d.arrest = d.arrest === "true"; // Boolean conversion
  });

  // 2. Filter out any rows that didn't parse
  const cleanData = data.filter((d) => d.date !== null);
  console.log("Success! Cleaned rows:", cleanData.length);

  // 3. SCALES (Updated to lowercase headers)
  const x = d3
    .scaleTime()
    .domain(d3.extent(cleanData, (d) => d.date))
    .range([0, chartWidth]);

  const y = d3
    .scalePoint()
    .domain([...new Set(cleanData.map((d) => d.primary_type))].sort())
    .range([chartHeight - 20, 20]); // Added 20px padding on top and bottom

  // 4. AXES
  const xAxisGroup = svg
    .append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x));

  svg.append("g").call(d3.axisLeft(y));

  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "clip")
    .append("rect")
    .attr("width", chartWidth)
    .attr("height", chartHeight);

  // Create a group for the dots and apply the clip path

  // Create a group for the dots and apply the clip path
  const dotGroup = svg.append("g").attr("clip-path", "url(#clip)");

  // Now, append your circles to 'dotGroup' instead of 'svg'
  const dots = dotGroup
    .selectAll("circle")
    .data(cleanData)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(d.date))
    .attr("cy", (d) => y(d.primary_type))
    .attr("r", 3)
    .style("fill", "steelblue")
    .style("opacity", 0.2);

  // 6. ZOOM (Abstraction - Category II)
  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 50]) // High zoom to see specific days
    .filter(event => {
      // disabled panning to allow for easier brushing interaction
      if (event.type === 'mousedown') return false;
      return !event.ctrlKey && !event.button;
    })
    .on("zoom", (event) => {
      const newX = event.transform.rescaleX(x);
      xAxisGroup.call(d3.axisBottom(newX));
      dots.attr("cx", (d) => newX(d.date));
      if (typeof updateBrushSelection === 'function') updateBrushSelection();
    });

  svg.call(zoom);

  // brushing, dynamic filters & queries (Category I)
  function updateBrushSelection() {
    const brushNode = svg.select(".brush").node();
    const tableContainer = d3.select("#selected-crimes-container");
    const tbody = d3.select("#selected-crimes-table tbody");
    const countSpan = d3.select("#selected-count");

    if (!brushNode) return;
    const selection = d3.brushSelection(brushNode);
    if (!selection) {
      dots.classed("brushed", false)
        .style("fill", "steelblue")
        .style("opacity", 0.2);
      tableContainer.style("display", "none");
      return;
    }
    const [[x0, y0], [x1, y1]] = selection;
    const currentX = d3.zoomTransform(svg.node()).rescaleX(x);

    let selectedCount = 0;
    const selectedData = [];

    dots.classed("brushed", d => {
      const cx = currentX(d.date);
      const cy = y(d.primary_type);
      const isSelected = (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1);

      if (isSelected) {
        selectedCount++;
        if (selectedData.length < 100) {
          selectedData.push(d);
        }
      }
      return isSelected;
    });

    dots.style("fill", function () { return d3.select(this).classed("brushed") ? "brown" : "steelblue"; })
      .style("opacity", function () { return d3.select(this).classed("brushed") ? 1 : 0.05; });

    // update the table with selected data
    if (selectedCount > 0) {
      tableContainer.classed("hidden-element", false);
      countSpan.text(selectedCount + (selectedCount > 100 ? " (showing first 100)" : ""));

      tbody.html(""); // clear old rows

      selectedData.forEach(d => {
        const row = tbody.append("tr");
        row.append("td").text(d.date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }));
        row.append("td").text(d.primary_type);
        row.append("td").text(d.arrest ? "Yes" : "No");
      });

      // update the bar chart with the selecteddata
      updateTimeChart(selectedData);
    } else {
      tableContainer.classed("hidden-element", true);
      d3.select("#time-chart-container").classed("hidden-element", true);
    }
  }

  // TIME OF DAY BAR CHART WITH BRUSHING
  const barMargin = { top: 20, right: 20, bottom: 40, left: 40 };
  const barWidth = 600 - barMargin.left - barMargin.right;
  const barHeight = 200 - barMargin.top - barMargin.bottom;

  const barSvg = d3.select("#time-barchart")
    .append("svg")
    .attr("width", barWidth + barMargin.left + barMargin.right)
    .attr("height", barHeight + barMargin.top + barMargin.bottom)
    .append("g")
    .attr("transform", `translate(${barMargin.left},${barMargin.top})`);

  // x scale (24hrs)
  const barX = d3.scaleLinear()
    .domain([0, 24])
    .range([0, barWidth]);

  barSvg.append("g")
    .attr("transform", `translate(0,${barHeight})`)
    .call(d3.axisBottom(barX).tickValues(d3.range(0, 25, 2)).tickFormat(d => d + "h"));

  // y scale
  const barY = d3.scaleLinear().range([barHeight, 0]);
  const barYAxis = barSvg.append("g");

  // x label
  barSvg.append("text")
    .attr("text-anchor", "middle")
    .attr("x", barWidth / 2)
    .attr("y", barHeight + barMargin.bottom - 5)
    .text("Hour of Day")
    .style("font-size", "12px");

  function updateTimeChart(data) {
    d3.select("#time-chart-container").classed("hidden-element", false);

    // tally up the hours
    const hourCounts = new Array(24).fill(0);

    // check which dots are currently brushed / selected
    svg.selectAll(".dot.brushed").each(function (d) {
      const hour = d.date.getHours();
      hourCounts[hour]++;
    });

    const plotData = hourCounts.map((count, hour) => ({ hour, count }));

    // y scale
    const maxCount = d3.max(plotData, d => d.count);
    barY.domain([0, maxCount > 0 ? maxCount : 1]);

    // y axis
    const yAxisConfig = d3.axisLeft(barY).ticks(Math.min(5, maxCount)).tickFormat(d3.format("d"));
    barYAxis.transition().duration(200).call(yAxisConfig);

    // bind data to bars
    const bars = barSvg.selectAll(".bar")
      .data(plotData);

    // enter + update
    bars.enter()
      .append("rect")
      .attr("class", "bar")
      .attr("fill", "brown")
      .merge(bars)
      .transition().duration(200)
      .attr("x", d => barX(d.hour))
      .attr("y", d => barY(d.count))
      .attr("width", (barWidth / 24) - 2)
      .attr("height", d => barHeight - barY(d.count));

    // remove old bars
    bars.exit().remove();
  }

  const brush = d3.brush()
    .extent([[0, 0], [chartWidth, chartHeight]])
    .on("end", updateBrushSelection);

  const brushGroup = svg.append("g")
    .attr("class", "brush")
    .call(brush);

  dotGroup.raise();

  // Create the vertical line (initially hidden)
  const vLine = svg
    .append("line")
    .attr("class", "mouse-line")
    .style("stroke", "#999")
    .style("stroke-width", "1px")
    .style("stroke-dasharray", "4,4")
    .style("opacity", 0);

  // Update position on mousemove over the chart area
  svg
    .on("mousemove", (event) => {
      const [mouseX] = d3.pointer(event);
      if (mouseX >= 0 && mouseX <= chartWidth) {
        vLine
          .attr("x1", mouseX)
          .attr("x2", mouseX)
          .attr("y1", 0)
          .attr("y2", chartHeight)
          .style("opacity", 1);
      }
    })
    .on("mouseleave", () => vLine.style("opacity", 0));
});
