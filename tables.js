function sortTable(n) {
    const table = document.getElementById("classes_table");
    const rows = Array.from(table.getElementsByTagName("tr")).slice(1);
    const isAscending = table.getElementsByTagName("th")[n].classList.toggle("asc");

    rows.sort((a, b) => {
        const cellA = a.getElementsByTagName("td")[n].textContent.trim();
        const cellB = b.getElementsByTagName("td")[n].textContent.trim();
        
        return (cellA > cellB ? 1 : (cellA < cellB ? -1 : 0)) * (isAscending ? 1 : -1);
    });

    rows.forEach(row => table.getElementsByTagName("tbody")[0].appendChild(row));
}
