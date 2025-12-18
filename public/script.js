// Auto-refresh kitchen screen every 5 seconds
if (window.location.pathname === "/kitchen") {
    setInterval(() => {
        location.reload();
    }, 5000);
}
