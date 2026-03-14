// === ROI Calculator App ===

let currentStep = 1;

function goToStep(step) {
  // Validate step 1 before proceeding
  if (step === 2 && currentStep === 1) {
    const industry = document.getElementById('industry').value;
    const employees = document.getElementById('employees').value;
    if (!industry || !employees) {
      shakeField(!industry ? 'industry' : 'employees');
      return;
    }
  }

  document.querySelectorAll('.calc-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + step).classList.add('active');

  // Update progress
  const fill = document.getElementById('progressFill');
  fill.style.width = (step * 33.33) + '%';

  document.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.progress-step').forEach(s => {
    if (parseInt(s.dataset.step) <= step) s.classList.add('active');
  });

  currentStep = step;

  if (step === 3) {
    document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function shakeField(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#e63030';
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.animation = '';
  }, 600);
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`;
document.head.appendChild(style);

function updateSliderLabel(slider) {
  document.getElementById('manualHoursValue').textContent = slider.value + ' hrs/week';
}

function calculateROI() {
  const avgSalary = parseFloat(document.getElementById('avgSalary').value) || 35;
  const manualHours = parseInt(document.getElementById('manualHours').value) || 40;
  const employees = document.getElementById('employees').value;

  // Get selected workflows
  const selectedWorkflows = document.querySelectorAll('input[name="workflow"]:checked');
  let workflowHours = 0;
  const recommendations = [];

  const workflowNames = {
    'data-entry': { name: 'Data Entry & Processing', desc: 'Automate data input, extraction, and transfer between systems' },
    'customer-service': { name: 'Customer Communication', desc: 'AI-powered email responses, follow-ups, and client onboarding' },
    'reporting': { name: 'Reporting & Analytics', desc: 'Automated report generation, dashboards, and performance tracking' },
    'invoicing': { name: 'Invoicing & Billing', desc: 'Streamline invoice creation, payment tracking, and reconciliation' },
    'lead-gen': { name: 'Lead Generation & Sales', desc: 'AI prospecting, lead scoring, and CRM automation' },
    'scheduling': { name: 'Scheduling & Coordination', desc: 'Smart scheduling, calendar management, and team coordination' }
  };

  selectedWorkflows.forEach(w => {
    const hours = parseInt(w.dataset.hours);
    workflowHours += hours;
    recommendations.push({
      name: workflowNames[w.value].name,
      desc: workflowNames[w.value].desc,
      hours: hours
    });
  });

  // If no workflows selected, use manual hours estimate with 30% automation rate
  const effectiveHoursSaved = workflowHours > 0
    ? Math.min(workflowHours, manualHours * 0.8)
    : manualHours * 0.3;

  // Calculate savings
  const weeklySavings = effectiveHoursSaved * avgSalary;
  const monthlySavings = weeklySavings * 4.33;
  const annualSavings = monthlySavings * 12;

  // Estimate investment based on company size (conservative monthly AI workflow cost)
  let monthlyInvestment;
  switch (employees) {
    case '1-5': monthlyInvestment = 200; break;
    case '6-15': monthlyInvestment = 450; break;
    case '16-50': monthlyInvestment = 800; break;
    case '51-100': monthlyInvestment = 1500; break;
    case '101-250': monthlyInvestment = 3000; break;
    case '250+': monthlyInvestment = 5000; break;
    default: monthlyInvestment = 500;
  }

  const annualInvestment = monthlyInvestment * 12;
  const roiPercent = Math.round(((annualSavings - annualInvestment) / annualInvestment) * 100);
  const paybackMonths = monthlySavings > 0 ? Math.max(1, Math.round(monthlyInvestment / monthlySavings * 2)) : 0;

  // Animate numbers
  animateNumber('annualSavings', annualSavings);
  animateNumber('timeSaved', effectiveHoursSaved, '', 0);
  document.getElementById('monthlySavings').textContent = '$' + formatNumber(Math.round(monthlySavings));
  document.getElementById('roiPercent').textContent = roiPercent + '%';
  document.getElementById('paybackPeriod').textContent = paybackMonths <= 1 ? '< 1 mo' : paybackMonths + ' mo';

  // Build recommendations
  const recList = document.getElementById('recommendationsList');
  recList.innerHTML = '';

  if (recommendations.length > 0) {
    recommendations.forEach(rec => {
      const savingsForRec = rec.hours * avgSalary * 4.33 * 12;
      recList.innerHTML += `
        <div class="recommendation">
          <div class="rec-icon">&#10003;</div>
          <div class="rec-content">
            <h5>${rec.name}</h5>
            <p>${rec.desc}</p>
          </div>
          <span class="rec-savings">$${formatNumber(Math.round(savingsForRec))}/yr</span>
        </div>
      `;
    });
  } else {
    recList.innerHTML = `
      <div class="recommendation">
        <div class="rec-icon">&#9733;</div>
        <div class="rec-content">
          <h5>Custom AI Workflow Analysis</h5>
          <p>Book a strategy session to identify the highest-impact AI workflows for your specific business operations.</p>
        </div>
        <span class="rec-savings">$${formatNumber(Math.round(annualSavings))}/yr potential</span>
      </div>
    `;
  }

  goToStep(3);
}

function animateNumber(elementId, target, prefix = '', decimals = 0) {
  const el = document.getElementById(elementId);
  const duration = 1200;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);

    el.textContent = prefix + formatNumber(current);

    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function submitLead(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById('leadName').value,
    email: document.getElementById('leadEmail').value,
    company: document.getElementById('leadCompany').value,
    phone: document.getElementById('leadPhone').value,
    industry: document.getElementById('industry').value,
    employees: document.getElementById('employees').value,
    revenue: document.getElementById('revenue').value,
    avgSalary: document.getElementById('avgSalary').value,
    manualHours: document.getElementById('manualHours').value,
    selectedWorkflows: Array.from(document.querySelectorAll('input[name="workflow"]:checked')).map(w => w.value),
    annualSavings: document.getElementById('annualSavings').textContent,
    timestamp: new Date().toISOString()
  };

  // Log data (in production, send to your backend/CRM)
  console.log('Lead captured:', JSON.stringify(data, null, 2));

  // Store locally
  const leads = JSON.parse(localStorage.getItem('roi_leads') || '[]');
  leads.push(data);
  localStorage.setItem('roi_leads', JSON.stringify(leads));

  // Show success
  document.getElementById('leadForm').style.display = 'none';
  document.getElementById('formSuccess').style.display = 'block';
}

// Auto-update manual hours slider when workflows are checked
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name="workflow"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      let totalHours = 0;
      document.querySelectorAll('input[name="workflow"]:checked').forEach(w => {
        totalHours += parseInt(w.dataset.hours);
      });
      if (totalHours > 0) {
        const slider = document.getElementById('manualHours');
        slider.value = Math.max(totalHours, parseInt(slider.value));
        updateSliderLabel(slider);
      }
    });
  });
});
