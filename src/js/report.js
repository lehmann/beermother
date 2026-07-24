import{n as p,fmt as a,formatVolume as s,formatVolumeRate as b,formatMaltMass as w,formatIngredientAmount as m,formatYeastAmount as R,normalizeReading as $,correctionSummary as g,correctionCheckResult as B,additionScheduleLabel as x,finalParameterCode as v,waterProfileSummary as F,scaledWaterSalts as T,originalWaterPlan as M,fermentationChartModel as S,effectiveWriFactor as k,abvBrewfather as L,WRI_FACTOR as y}from"./engine.js";import{fermentationChartSvg as W}from"./chart.js";import{BRAND_LOGO as j,FONT_CSS as I,assetUrl as P}from"./ui.js";function z(t){return Number.isFinite(Number(t))?`${a(t,1)} \xB0C`:"-"}function G(t){return Number.isFinite(Number(t))?`${a(t,0)} dias`:"-"}export function htmlEscape(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}export function buildBrewReport(t,e){const r=e.props,n=p(r.mashWaterUsedL,e.volumes.mashWater),c=Math.max(0,e.volumes.totalWater-n),i=p(r.targetVolumeL,20)?p(r.trubLossL)/p(r.targetVolumeL,20)*100:0,l=M(e.recipe),d=e.scaledFermentables.filter(o=>o.use==="Mostura").reduce((o,V)=>o+p(V.amountKg),0),C=T(r,e.volumes).filter(o=>p(o.totalG)).map(o=>[o.name,`${a(o.mashG,1)} g`,`${a(o.spargeG,1)} g`,`${a(o.totalG,1)} g`]),u=k(r),f=readingLogRow("Pr\xE9-fervura",e.volumes.preBoil,e.preBoilPlato,t.measurements.preBoil,u),h=readingLogRow("P\xF3s-fervura",e.expected.hotPostBoil,e.postBoilPlato,t.measurements.postBoil,u),E=brewCorrectionCheckRows(t,e);return{title:e.recipe.name||"Receita",generatedAt:new Date().toLocaleString("pt-BR"),notes:String(t.notes||"").trim(),summaryRows:[["Volume alvo",s(r.targetVolumeL,2)],["OG / FG",`${e.og.toFixed(3)} / ${e.fg.toFixed(3)}`],["ABV / IBU",`${a(L(e.og,e.fg),1)}% / ${e.ibu}`],["Fervura",`${a(e.recipe.boilTimeMin,0)} min`],["Pr\xE9-fervura",g(e.preCorrection)],["P\xF3s-fervura",g(e.postCorrection)]],recipeRows:[["Receita",e.recipe.name||"-"],["Estilo",e.recipe.styleName||e.recipe.style||"-"],["Cervejeiro",e.recipe.brewer||"-"],["OG",e.og.toFixed(3)],["FG",e.fg.toFixed(3)],["ABV",`${a(L(e.og,e.fg),1)}%`],["IBU",e.ibu],...p(e.ebc)>0?[["Cor",`${a(e.ebc,1)} EBC`]]:[],["Volume original",s(e.recipe.batchVolumeL,2)],["Volume alvo",s(r.targetVolumeL,2)],["Fervura",`${a(e.recipe.boilTimeMin,0)} min`],["Fonte",e.recipe.sourceUrl||"-"]],conditionRows:[["Efici\xEAncia de mostura",`${a(r.mashEfficiencyPct,1)}%`],["Evapora\xE7\xE3o",`${a(r.evaporationPct,1)}%/h \xB7 ${b(r.evaporationLh,2)}`],["Perda de trub",`${s(r.trubLossL,2)} \xB7 ${a(i,1)}%`],["Absor\xE7\xE3o dos gr\xE3os",`${a(r.grainAbsorptionLkg,2)} L/kg`],["Rela\xE7\xE3o \xE1gua/malte",`${a(r.waterToGrainRatioLkg,2)} L/kg`],["Malte total",w(e.volumes.grainKg)]],maltRows:e.scaledFermentables.map(o=>[o.name,o.use,w(o.amountKg),o.use==="Mostura"&&d?`${a(o.amountKg/d*100,1)}%`:"-"]),mashAdditionRows:e.mashAdditions.map(o=>[o.name,o.type,m(o.amount,o.unit),o.moment||o.use]),originalWaterRows:[["Mostura",s(l.mashWaterL,1)],["Lavagem",s(l.spargeWaterL,1)],["Total",s(l.totalWaterL,1)],["Volume final da receita",s(e.recipe.batchVolumeL,1)]],waterRows:[["Mostura",s(e.volumes.mashWater,1),s(n,1)],["Lavagem",s(e.volumes.sparge,1),s(c,1)],["Total",s(e.volumes.totalWater,1),s(n+c,1)]],saltRows:C,readingRows:[f,h,["Fria / Trub",`${s(e.expected.fermenterVolume,2)} fermentador`,coldReadingLog(t),"-"]],decisionRows:[["Pr\xE9-fervura",f[1],f[2],g(e.preCorrection)],["P\xF3s-fervura",h[1],h[2],g(e.postCorrection)],["Fria / Trub",`${s(e.expected.fermenterVolume,2)} fermentador`,coldReadingLog(t),"Registro final"]],correctionRows:[correctionLogRow("Pr\xE9-fervura",e.preCorrection),correctionLogRow("P\xF3s-fervura",e.postCorrection)],correctionCheckRows:E,correctionRoundRows:correctionRoundRows(t),parameterRows:[["Volume alvo",s(r.targetVolumeL,2)],["Efici\xEAncia de mostura",`${a(r.mashEfficiencyPct,1)}%`],["Evapora\xE7\xE3o",`${a(r.evaporationPct,1)}%/h \xB7 ${b(r.evaporationLh,2)}`],["Perda de trub",`${s(r.trubLossL,2)} \xB7 ${a(i,1)}%`],["Absor\xE7\xE3o dos gr\xE3os",`${a(r.grainAbsorptionLkg,2)} L/kg`],["Rela\xE7\xE3o \xE1gua/malte",`${a(r.waterToGrainRatioLkg,2)} L/kg`],...Math.abs(u-y)>1e-4?[["Fator WRI",a(u,2)]]:[],...p(r.mashTunDeadSpaceL)>0?[["Volume morto recuper\xE1vel",s(r.mashTunDeadSpaceL,2)]]:[],["\xC1gua ajustada",F(e.waterProfile)],["Pr\xF3xima brassagem",v(e)]],boilRows:[["Tempo de fervura",`${a(e.recipe.boilTimeMin,0)} min`]],hopRows:e.boilAdditions.filter(o=>o.kind==="hop").map(o=>[o.name,m(o.amount,o.unit),`${a(o.plannedAlphaAcidPct,2)}%`,o.actualAlphaAcidPct===""?"-":`${a(o.actualAlphaAcidPct,2)}%`,x(o)]),otherBoilAdditionRows:e.boilAdditions.filter(o=>o.kind!=="hop").map(o=>[o.name,o.type,m(o.amount,o.unit),x(o)]),additionRows:[...e.mashAdditions.map(o=>["Mostura",o.name,m(o.amount,o.unit),A(t,o,o.moment||o.use)]),...e.boilAdditions.map(o=>["Fervura",o.name,m(o.amount,o.unit),A(t,o,x(o))]),...(e.scaledYeasts||[]).map(o=>["Fermenta\xE7\xE3o",o.name,R(o.amount,o.unit),"Inocula\xE7\xE3o"])],timerEventRows:timerEventRows(t),yeastRows:(e.scaledYeasts||[]).length?e.scaledYeasts.map(o=>[o.name,R(o.amount,o.unit)]):[["-","-"]],fermentationTitle:e.recipe.fermentationProfileName?`Perfil de fermenta\xE7\xE3o - ${e.recipe.fermentationProfileName}`:"Perfil de fermenta\xE7\xE3o",fermentationRows:(e.recipe.fermentation||[]).length?e.recipe.fermentation.map(o=>[o.name,z(o.temperatureC),G(o.days)]):[["Sem perfil no XML","-","-"]],fermentationChartHtml:`<div class="report-chart"><div class="chart-legend"><span class="chart-temp">Temp. planejada</span><span class="chart-temp-real">Temp. lida</span><span class="chart-extract">Extrato</span></div>${W(S(t,e))}</div>`,analysisRows:[["Efici\xEAncia de mostura",`${a(e.analysis.mashEfficiencyPct,1)}%`],["Absor\xE7\xE3o dos gr\xE3os",`${a(e.analysis.grainAbsorptionLkg,2)} L/kg`],["Evapora\xE7\xE3o",`${a(e.analysis.evaporationPct,1)}%/h \xB7 ${b(e.analysis.evaporationLh,2)}`],["Perda de trub",s(e.analysis.trubLossL,2)],["Par\xE2metros pr\xF3xima brassagem",v(e)]]}}function A(t,e,r){const n=t?.additionChecks||{},c=`${e.kind||"misc"}:${e.id||e.name||""}`,i=n[c];return i?`${r} \xB7 \u2713 ${formatTimerEventTime(i)}`:r}export function correctionRoundRows(t){const e=t?.correctionRounds||{},r=(n,c)=>(Array.isArray(e[n])?e[n]:[]).map(i=>[c,`${i.round}\xAA`,i.action||"-",i.checkWri===""||i.checkWri===void 0?"-":`${a(i.checkWri,1)} WRI`,formatTimerEventTime(i.at)]);return[...r("pre","Pr\xE9-fervura"),...r("post","P\xF3s-fervura")]}export function brewCorrectionCheckRows(t,e){return[{label:"Pr\xE9-fervura",stage:"pre",correction:e.preCorrection,expectedPlato:e.preBoilPlato,kind:"pre"},{label:"P\xF3s-fervura",stage:"post",correction:e.postCorrection,expectedPlato:e.postBoilPlato,kind:"post"}].flatMap(r=>{const n=t?.correctionChecks?.[r.stage];if(!n||!n.wri||r.correction.status!=="ready"||r.correction.action==="Sem corre\xE7\xE3o")return[];const c=k(e.props),i=B(r.correction,n,r.expectedPlato,r.kind,e.props.evaporationLh,c),l=$({volumeL:r.correction.targetVolumeL,wri:n.wri},c),d=`${a(n.wri,1)} WRI \xB7 ${a(l.realPlato,1)} \xB0P \xB7 ${l.sg.toFixed(3)}`;return[[r.label,`${a(r.expectedPlato,1)} \xB0P`,d||"-",[i.summary||i.title,i.detail].filter(Boolean).join(" \xB7 ")]]})}export function timerEventRows(t){return(t?.timerEvents||[]).map(e=>[formatTimerEventTime(e.at),e.stage||"-",e.event||"-",e.detail||"-"])}export function formatTimerEventTime(t){const e=new Date(t);return Number.isNaN(e.getTime())?"-":e.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}export function readingLogRow(t,e,r,n,c=y){const i=$(n,c),l=i.volumeL||i.wri?`${i.volumeL?s(i.volumeL,2):"-"} \xB7 ${i.wri?`${a(i.wri,1)} WRI`:"-"}`:"-",d=i.realPlato?`${a(i.realPlato,1)} \xB0P \xB7 ${i.sg.toFixed(3)}`:"-";return[t,`${s(e,2)} \xB7 ${a(r,1)} \xB0P`,l,d]}export function coldReadingLog(t){const e=t.measurements.cold||{},r=e.trubVolumeL?`${s(e.trubVolumeL,2)} trub`:"-",n=e.fermenterVolumeL?`${s(e.fermenterVolumeL,2)} fermentador`:"-";return`${r} \xB7 ${n}`}export function correctionLogRow(t,e){const r=e.status==="pending"||e.action==="Sem corre\xE7\xE3o"?"-":s(Math.abs(e.deltaL),2),n=e.extraBoilMin?`Fervura extra ${a(e.extraBoilMin,1)} min \xB7 IBU estimado ${e.estimatedIbu}`:r;return[t,e.status==="pending"?"Aguardando leitura":e.action,s(e.targetVolumeL,2),n]}export function markdownTable(t,e){const r=t.map(markdownCell),n=e.map(c=>`| ${c.map(markdownCell).join(" | ")} |`);return[`| ${r.join(" | ")} |`,`| ${r.map(()=>"---").join(" | ")} |`,...n].join(`
`)}export function markdownCell(t){return String(t??"-").replace(/\|/g,"\\|").replace(/\n/g,"<br>")}export function generateBrewLog(t,e){const r=buildBrewReport(t,e),n=[`# Relat\xF3rio de Brassagem - ${r.title}`,`Gerado em: ${r.generatedAt}`,"","## Resumo",markdownTable(["Item","Valor"],r.summaryRows),"","## Receita usada",markdownTable(["Item","Valor"],r.recipeRows),"","## Leituras e corre\xE7\xF5es",markdownTable(["Etapa","Esperado","Leitura","Corre\xE7\xE3o"],r.decisionRows),"","## Par\xE2metros",markdownTable(["Par\xE2metro","Valor"],r.parameterRows)];return r.correctionRoundRows.length&&n.push("","## Rodadas de corre\xE7\xE3o",markdownTable(["Etapa","Rodada","A\xE7\xE3o executada","Leitura seguinte","Hor\xE1rio"],r.correctionRoundRows)),r.correctionCheckRows.length&&n.push("","## Confer\xEAncia das corre\xE7\xF5es",markdownTable(["Etapa","Alvo","Leitura ap\xF3s corre\xE7\xE3o","Resultado"],r.correctionCheckRows)),r.additionRows.length&&n.push("","## Adi\xE7\xF5es registradas",markdownTable(["Etapa","Insumo","Dose","Momento"],r.additionRows)),r.timerEventRows.length&&n.push("","## Eventos do contador",markdownTable(["Hor\xE1rio","Etapa","Evento","Detalhe"],r.timerEventRows)),n.push("","## Anota\xE7\xF5es",r.notes||"-"),`${n.join(`
`)}
`}export function reportCardsHtml(t){return`<div class="cards">${t.slice(0,6).map(([e,r])=>`<div class="card"><span>${htmlEscape(e)}</span><b>${htmlEscape(r)}</b></div>`).join("")}</div>`}export function reportSectionHtml(t,e){return`<section><h2>${htmlEscape(t)}</h2><div class="body">${e}</div></section>`}export function reportTableHtml(t,e){return`<table><thead><tr>${t.map(r=>`<th>${htmlEscape(r)}</th>`).join("")}</tr></thead><tbody>${e.map(r=>`<tr>${r.map(n=>`<td>${htmlEscape(n)}</td>`).join("")}</tr>`).join("")}</tbody></table>`}export function generateBrewReportHtml(t,e){const r=buildBrewReport(t,e);return`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relat\xF3rio de Brassagem - ${htmlEscape(r.title)}</title>
  <link href="${htmlEscape(P(I))}" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f2ea; color: #221a12; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.45; }
    main { width: min(960px, calc(100% - 32px)); margin: 24px auto; display: grid; gap: 14px; }
    header, section { background: #fffdf9; border: 1px solid #e6ddcf; border-radius: 16px; overflow: hidden; }
    header { padding: 22px; display: grid; gap: 14px; }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand img { width: 156px; height: auto; object-fit: contain; }
    .date { color: #7a6f5f; font-size: 13px; font-weight: 560; }
    h1, h2 { margin: 0; color: #221a12; letter-spacing: 0; }
    h1 { font-size: 30px; line-height: 1.08; }
    h2 { padding: 14px 16px; border-bottom: 1px solid #ece4d6; font-size: 15px; }
    h2::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 99px; background: #d98324; }
    .style { margin: 4px 0 0; color: #6d6152; font-size: 15px; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .card { border: 1px solid #eadfcd; border-radius: 12px; padding: 10px 12px; background: #faf6ee; }
    .card span { display: block; color: #8a7d6a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .card b { display: block; margin-top: 4px; font-size: 17px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px 12px; border-bottom: 1px solid #f0e9dc; text-align: left; vertical-align: top; }
    th { background: #faf6ee; color: #59503f; font-size: 12px; font-weight: 700; }
    tr:last-child td { border-bottom: 0; }
    .body { padding: 0; }
    .notes { padding: 14px 16px; white-space: pre-wrap; }
    .report-chart { padding: 14px 16px 16px; display: grid; gap: 10px; }
    .report-chart svg { display: block; width: 100%; height: auto; }
    .chart-legend { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 12px; color: #7a6f5f; font-size: 12px; font-weight: 700; }
    .chart-legend span { display: inline-flex; align-items: center; gap: 6px; }
    .chart-legend span::before { content: ""; width: 18px; height: 3px; border-radius: 999px; background: currentColor; }
    .chart-temp { color: #2563eb; }
    .chart-temp-real { color: #15803d; }
    .chart-extract { color: #d98324; }
    .chart-axis text, .chart-grid text { fill: #8a7d6a; font-size: 11px; font-weight: 620; }
    .chart-grid line, .chart-axis line { stroke: #ece4d6; stroke-width: 1; }
    .chart-axis path { stroke: #d9cdb8; stroke-width: 1; fill: none; }
    .chart-temp-line { fill: none; stroke: #2563eb; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .chart-temp-real-line { fill: none; stroke: #15803d; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 7 5; }
    .chart-temp-real-point { fill: #f0fdf4; stroke: #15803d; stroke-width: 2; }
    .chart-extract-line { fill: none; stroke: #d98324; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .chart-extract-point { fill: #fff7ed; stroke: #d98324; stroke-width: 2; }
    .chart-fg-line { stroke: #d98324; stroke-width: 1.5; stroke-dasharray: 5 5; opacity: .72; }
    .print-actions { position: sticky; top: 0; z-index: 3; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 0; background: #f6f2ea; }
    button { border: 1px solid #d98324; border-radius: 999px; background: #d98324; color: #fff; min-height: 38px; padding: 8px 16px; font: inherit; font-weight: 700; cursor: pointer; }
    button.ghost { background: transparent; color: #7a5b2b; border-color: #d9cdb6; }
    @media (max-width: 760px) { main { width: min(100% - 18px, 960px); margin: 10px auto; } .cards, .two { grid-template-columns: 1fr; } h1 { font-size: 24px; } }
    @media print { body { background: #fff; } main { width: 100%; margin: 0; gap: 10px; } .print-actions { display: none; } header, section { break-inside: avoid; border-color: #ddd3c2; border-radius: 0; } }
  </style>
</head>
<body>
  <main>
    <div class="print-actions"><button class="ghost" onclick="window.close(); history.length > 1 && history.back();">Voltar \xE0 brassagem</button><button onclick="window.print()">Salvar em PDF</button></div>
    <header>
      <div class="brand">
        <img src="${htmlEscape(P(j))}" alt="Beer School Academy">
        <span class="date">${htmlEscape(r.generatedAt)}</span>
      </div>
      <div>
        <h1>${htmlEscape(r.title)}</h1>
        <p class="style">${htmlEscape(e.recipe.styleName||"Relat\xF3rio de brassagem din\xE2mica")}</p>
      </div>
      ${reportCardsHtml(r.summaryRows)}
    </header>
    ${reportSectionHtml("Receita usada",reportTableHtml(["Item","Valor"],r.recipeRows))}
    ${reportSectionHtml("Leituras e corre\xE7\xF5es",reportTableHtml(["Etapa","Esperado","Leitura","Corre\xE7\xE3o"],r.decisionRows))}
    ${reportSectionHtml("Par\xE2metros",reportTableHtml(["Par\xE2metro","Valor"],r.parameterRows))}
    ${reportSectionHtml("Gr\xE1fico da fermenta\xE7\xE3o",r.fermentationChartHtml)}
    ${r.correctionRoundRows.length?reportSectionHtml("Rodadas de corre\xE7\xE3o",reportTableHtml(["Etapa","Rodada","A\xE7\xE3o executada","Leitura seguinte","Hor\xE1rio"],r.correctionRoundRows)):""}
    ${r.correctionCheckRows.length?reportSectionHtml("Confer\xEAncia das corre\xE7\xF5es",reportTableHtml(["Etapa","Alvo","Leitura ap\xF3s corre\xE7\xE3o","Resultado"],r.correctionCheckRows)):""}
    ${r.additionRows.length?reportSectionHtml("Adi\xE7\xF5es registradas",reportTableHtml(["Etapa","Insumo","Dose","Momento"],r.additionRows)):""}
    ${r.timerEventRows.length?reportSectionHtml("Eventos do contador",reportTableHtml(["Hor\xE1rio","Etapa","Evento","Detalhe"],r.timerEventRows)):""}
    ${reportSectionHtml("Anota\xE7\xF5es",`<div class="notes">${htmlEscape(r.notes||"-")}</div>`)}
  </main>
</body>
</html>`}
