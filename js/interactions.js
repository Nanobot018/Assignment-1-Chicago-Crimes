const zoom = d3.zoom()
  .scaleExtent([1, 20]) 
  .extent([[0, 0], [width, height]])
  .on("zoom", (event) => {
     const newX = event.transform.rescaleX(xScale);
     xAxis.call(d3.axisBottom(newX));
     line.attr("d", lineGenerator.x(d => newX(d.date)));
  });
svg.call(zoom);