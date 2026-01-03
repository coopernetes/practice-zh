function copyText(buttonElement) {
  const text = buttonElement.getAttribute("data-copy");
  navigator.clipboard.writeText(text).then(() => {
    const feedback =
      buttonElement.parentElement.querySelector(".copy-feedback");
    feedback.classList.add("show");
    setTimeout(() => feedback.classList.remove("show"), 2000);
  });
}
