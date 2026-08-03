document.getElementById('year').textContent = new Date().getFullYear();



const vacationPopup = document.getElementById("vacationPopup");
const closeVacationPopup = document.getElementById("closeVacationPopup");

if (vacationPopup) {
  document.body.style.overflow = "hidden";

  closeVacationPopup.addEventListener("click", () => {
    vacationPopup.style.display = "none";
    document.body.style.overflow = "";
  });
}