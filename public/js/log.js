document.addEventListener("DOMContentLoaded", () => {
  const rows = document.querySelectorAll("tbody tr");
  rows.forEach((row, i) => {
    row.style.opacity = 0;
    setTimeout(() => {
      row.style.transition = "opacity 0.4s ease-in";
      row.style.opacity = 1;
    }, i * 100);
  });
});
