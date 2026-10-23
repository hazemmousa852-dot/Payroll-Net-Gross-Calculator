(function (root) {
  'use strict';
  // Private-sector, full-month 2026 model. Law 7/2024, article 8.
  function annualTax(income) {
    const taxable = Math.floor(Math.max(0, income) / 10) * 10;
    const rates = [0, .10, .15, .20, .225, .25, .275];
    const ceilings = [40000, 55000, 70000, 200000, 400000, 1200000, Infinity];
    const first = taxable > 1200000 ? 5 : taxable > 900000 ? 4 : taxable > 800000 ? 3 : taxable > 700000 ? 2 : taxable > 600000 ? 1 : 0;
    let tax = 0, lower = 0;
    for (let i = first; i < rates.length; i++) {
      tax += Math.max(0, Math.min(taxable, ceilings[i]) - lower) * rates[i];
      lower = ceilings[i];
    }
    return { tax, taxable };
  }
  function calculate(wage, nonTaxable, flags = {}, legal) {
    if (![wage, nonTaxable].every(Number.isFinite) || wage < 0 || nonTaxable < 0) throw new Error('أدخل أرقامًا غير سالبة.');
    const insCap = Math.min(legal.insuranceCap, Math.max(legal.insuranceFloor, wage));
    const insurance = insCap * (flags.isPensioner ? legal.insuranceRate.pensioner : legal.insuranceRate.employee);
    const exemption = legal.personalExemption * (flags.isDisabled ? legal.disabilityExemptionMultiplier : 1);
    const { tax, taxable } = annualTax((wage - insurance) * 12 - exemption);
    const gross = wage + nonTaxable, mTax = tax / 12;
    const martyrsFund = flags.isMartyrsFundExempt ? 0 : gross * legal.martyrsFundRate;
    const insDetail = { base: insCap, oldAge: flags.isPensioner ? 0 : insCap * .09, bonus: flags.isPensioner ? 0 : insCap * .01, sickness: insCap * .01, total: insurance };
    return { gross, wage, nonTaxable, insurance, insDetail, employerIns: insCap * legal.insuranceRate.employer, exemption, taxable, tax, mTax, martyrsFund, net: gross - insurance - mTax - martyrsFund, effRate: wage > insurance ? tax / ((wage - insurance) * 12) * 100 : 0 };
  }
  // Search each tax column separately: net pay drops when a lower band is withdrawn.
  function solve(target, nonTaxable, flags, legal) {
    if (!Number.isFinite(target) || target <= 0 || nonTaxable < 0 || nonTaxable >= target) throw new Error('الصافي المستهدف يجب أن يكون موجبًا وأكبر من غير الخاضع.');
    const rate = flags.isPensioner ? legal.insuranceRate.pensioner : legal.insuranceRate.employee;
    const exemption = legal.personalExemption * (flags.isDisabled ? legal.disabilityExemptionMultiplier : 1);
    const boundaries = [0, legal.insuranceFloor, legal.insuranceCap];
    for (const t of [600010,700010,800010,900010,1200010]) boundaries.push((t + exemption) / 12 + legal.insuranceCap * rate);
    boundaries.push(Math.max(target * 3 + legal.insuranceCap, 1000000));
    boundaries.sort((a,b)=>a-b);
    let best = null;
    for (let j=0;j<boundaries.length-1;j++) {
      let low=boundaries[j], high=boundaries[j+1]-1e-7;
      for(let i=0;i<70;i++) {
        const mid=(low+high)/2, r=calculate(mid,nonTaxable,flags,legal);
        if(r.net<target) low=mid; else high=mid;
      }
      // Annual rounding creates small steps; select an exact cash result in the nearby tax cells.
      for(let offset=-4;offset<=4;offset++) {
        const probe=calculate((low+high)/2+offset*.25,nonTaxable,flags,legal);
        const fundRate=flags.isMartyrsFundExempt?0:legal.martyrsFundRate;
        const w=(target+probe.insurance+probe.mTax)/(1-fundRate)-nonTaxable;
        if(w<boundaries[j]||w>=boundaries[j+1]) continue;
        const r=calculate(w,nonTaxable,flags,legal);
        if(Math.abs(r.net-target)<.011 && (!best||w<best.wage)) best=r;
      }
    }
    if(!best) throw new Error('تعذر مطابقة الصافي بدقة؛ راجع المدخلات وفروض التسوية.');
    return best;
  }
  const api={ annualTax, calculate, solve };
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.PayrollRules=api;
})(typeof window!=='undefined'?window:globalThis);
