function copyText(buttonElement) {
  const text = buttonElement.getAttribute("data-copy");
  navigator.clipboard.writeText(text).then(() => {
    const feedback =
      buttonElement.parentElement.querySelector(".copy-feedback");
    feedback.classList.add("show");
    setTimeout(() => feedback.classList.remove("show"), 2000);
  });
}

function fadeOut(element) {
  element.style.transition = "opacity 0.5s ease-out";
  element.style.opacity = 0;
  setTimeout(() => {
    element.style.display = "none";
  }, 3000);
}
