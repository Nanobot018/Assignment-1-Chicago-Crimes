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
    .on("zoom", (event) => {
      const newX = event.transform.rescaleX(x);
      xAxisGroup.call(d3.axisBottom(newX));
      dots.attr("cx", (d) => newX(d.date));
    });

  svg.call(zoom);

  // 7. TOOLTIP (Details-on-demand - Category II)
  dots
    .on("mouseover", function (event, d) {
      // 1. Visual Selection: Change color and size
      d3.select(this)
        .raise() // Brings the hovered dot to the front
        .attr("r", 8)
        .style("fill", "#ff8c00") // Bright Orange
        .style("opacity", 1);

      // 2. Details-on-Demand: Tooltip
      const tooltip = d3.select("#tooltip");
      tooltip
        .classed("hidden", false)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");

      d3.select("#crime-type").text(d.primary_type);
      d3.select("#crime-date").text(d3.timeFormat("%b %d, %H:%M")(d.date));
      d3.select("#crime-arrest").text(d.arrest ? "Yes" : "No");
    })
    .on("mouseout", function () {
      d3.select(this)
        .attr("r", 3) // Reset size
        .style("fill", "steelblue") // Reset color
        .style("opacity", 0.1); // Reset opacity

      d3.select("#tooltip").classed("hidden", true);
    });

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
