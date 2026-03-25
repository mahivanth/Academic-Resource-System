// ARUS Dashboard Theme and UI Logic
document.addEventListener('DOMContentLoaded', () => {
    // Alert dismissal
    const closeButtons = document.querySelectorAll('.alert .close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const alert = btn.closest('.alert');
            if (alert) {
                alert.style.opacity = '0';
                setTimeout(() => {
                    alert.remove();
                }, 300);
            }
        });
    });

    // Mobile sidebar toggle (if implemented later)
    // Add logic here if needed
});
