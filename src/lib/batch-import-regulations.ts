import fs from 'fs';
import path from 'path';
import prisma from './db';
import { PDFParse } from 'pdf-parse';

async function batchImport() {
  const gmpDirectory = path.join(process.cwd(), 'EU GMP ');

  if (!fs.existsSync(gmpDirectory)) {
    console.error(`Directory not found: ${gmpDirectory}`);
    process.exit(1);
  }

  // Ensure EudraLex Volume 4 source exists in the DB
  const source = await prisma.regulationSource.upsert({
    where: { regulationId: 'EU-GMP-VOL4' },
    update: {},
    create: {
      regulationId: 'EU-GMP-VOL4',
      title: 'EudraLex Volume 4: Good Manufacturing Practice (GMP)',
      authority: 'European Commission',
      version: '2026.1',
      latestAvailableVersion: '2026.1',
      status: 'UP_TO_DATE',
    },
  });

  console.log(`Target Regulation Source verified: ${source.title}`);

  const files = fs.readdirSync(gmpDirectory);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

  console.log(`Found ${pdfFiles.length} PDF files inside: ${gmpDirectory}`);

  let totalParsed = 0;

  for (const filename of pdfFiles) {
    const filepath = path.join(gmpDirectory, filename);
    console.log(`\nProcessing file: ${filename}...`);

    try {
      const buffer = fs.readFileSync(filepath);
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const rawText = textResult.text || '';
      await parser.destroy();

      if (!rawText.trim()) {
        console.warn(`Warning: Extracted text from ${filename} is empty. Skipping.`);
        continue;
      }

      // Structure parsing rules
      const requirementsToCreate: any[] = [];
      const lines = rawText.split('\n');

      let currentChapter = 'Chapter 1: Scope';
      let currentSection = '1.1';
      let currentTitle = 'General Principles';
      let currentTextLines: string[] = [];

      const flushRequirement = () => {
        const text = currentTextLines.join(' ').trim();
        if (text.length > 30) {
          let category = 'Quality System';
          const lowerText = text.toLowerCase();
          if (lowerText.includes('training') || lowerText.includes('personnel') || lowerText.includes('staff')) {
            category = 'Personnel';
          } else if (lowerText.includes('equipment') || lowerText.includes('hvac') || lowerText.includes('cleanroom') || lowerText.includes('facility')) {
            category = 'Premises and Equipment';
          } else if (lowerText.includes('document') || lowerText.includes('record') || lowerText.includes('sop')) {
            category = 'Documentation';
          } else if (lowerText.includes('manufactur') || lowerText.includes('cleaning') || lowerText.includes('process')) {
            category = 'Production';
          } else if (lowerText.includes('laboratory') || lowerText.includes('testing') || lowerText.includes('oos')) {
            category = 'Laboratory Control';
          } else if (lowerText.includes('supplier') || lowerText.includes('contract') || lowerText.includes('audit')) {
            category = 'Supplier Management';
          }

          let riskLevel = 'MAJOR';
          if (lowerText.includes('must') || lowerText.includes('critical') || lowerText.includes('shall')) {
            riskLevel = 'CRITICAL';
          } else if (lowerText.includes('should') || lowerText.includes('recommends')) {
            riskLevel = 'MAJOR';
          } else {
            riskLevel = 'MINOR';
          }

          let expectedEvidence = 'Quality manual controls check';
          if (category === 'Personnel') {
            expectedEvidence = 'SOP training logs, personnel CVs, training assessment records, job description profiles.';
          } else if (category === 'Premises and Equipment') {
            expectedEvidence = 'Equipment calibration certificates, maintenance logs, cleanroom classification reports, IQ/OQ/PQ protocols.';
          } else if (category === 'Documentation') {
            expectedEvidence = 'Approved Quality Manual, signed SOP catalog, audit logs, batch record archive list.';
          } else if (category === 'Production') {
            expectedEvidence = 'Cleaning validation reports, batch manufacturing records, environmental monitoring charts, line clearance records.';
          } else if (category === 'Laboratory Control') {
            expectedEvidence = 'Method validation protocols, reagent logs, OOS investigation files, raw laboratory notebooks.';
          } else if (category === 'Supplier Management') {
            expectedEvidence = 'Technical Quality Agreements (QAs), supplier audit questionnaires, approved vendor lists.';
          }

          // Clean names to prevent database unique constraints from matching generic numbers
          const cleanFileName = filename.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
          const generatedReqId = `EU-GMP-${cleanFileName}-${Math.floor(1000 + Math.random() * 9000)}`;

          requirementsToCreate.push({
            requirementId: generatedReqId,
            regulationSourceId: source.id,
            chapter: currentChapter,
            section: currentSection,
            title: currentTitle,
            category,
            riskLevel,
            requirementText: text,
            expectedEvidence,
            applicableAreas: JSON.stringify(['Quality Assurance', 'Production']),
            affectedProcesses: JSON.stringify(['Document Management', 'Training']),
            status: 'APPROVED',
            aiExtracted: true,
            changeType: 'NEW',
          });
        }
        currentTextLines = [];
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (/^(chapter|annex|part)\s+\d+/i.test(trimmed)) {
          flushRequirement();
          currentChapter = trimmed;
          const parts = trimmed.split(':');
          if (parts.length > 1) {
            currentChapter = parts[0].trim();
            currentTitle = parts.slice(1).join(':').trim();
          }
        } else if (/^(\d+\.\d+)\s+/i.test(trimmed)) {
          flushRequirement();
          const match = trimmed.match(/^(\d+\.\d+)\s+(.*)/);
          if (match) {
            currentSection = match[1];
            currentTitle = match[2];
          }
        } else {
          currentTextLines.push(trimmed);
        }
      }
      flushRequirement();

      // Bulk write
      let fileCount = 0;
      for (const reqData of requirementsToCreate) {
        await prisma.regulatoryRequirement.upsert({
          where: { requirementId: reqData.requirementId },
          update: reqData,
          create: reqData,
        });
        fileCount++;
      }

      console.log(`Successfully imported ${fileCount} clauses from ${filename}`);
      totalParsed += fileCount;
    } catch (e) {
      console.error(`Failed to process file ${filename}:`, e);
    }
  }

  console.log(`\n==========================================`);
  console.log(`BATCH SEED COMPLETE: Imported ${totalParsed} regulatory clauses.`);
  console.log(`==========================================`);
}

batchImport()
  .catch(e => {
    console.error('Batch import failed:', e);
    process.exit(1);
  });
