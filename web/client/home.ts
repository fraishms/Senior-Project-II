// Home page: footer year + replay the logo animation on click.
const yearElement = document.getElementById("year");
if (yearElement) yearElement.textContent = String(new Date().getFullYear());

const logo = document.querySelector<SVGElement>(".logo");
if (logo) {
  const bars = logo.querySelectorAll<SVGElement>(".bar");
  logo.addEventListener("click", () => {
    bars.forEach((bar) => {
      bar.style.animation = "none";     // stop the animation and reset the bar
      void bar.getBoundingClientRect(); // force the browser to apply the reset
      bar.style.animation = "";         // let the CSS play it again
    });
  });
}
