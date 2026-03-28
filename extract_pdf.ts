import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath1 = 'C:/Users/alber/Desktop/Albert/Examenes Cloud/AI/Universe Agent/Contenido Aplicaciones/Autopsy/Autopsy3_ReYDeS.pdf';
const pdfPath2 = 'C:/Users/alber/Desktop/Albert/Examenes Cloud/AI/Universe Agent/Contenido Aplicaciones/Autopsy/PeruHack2014_Autopsy3_Alonso_ReYDeS.pdf';

async function extractText(pdfPath, outputPath) {
    try {
        console.log('Reading PDF from:', pdfPath);
        const dataBuffer = fs.readFileSync(pdfPath);
        
        const data = await pdf(dataBuffer);
        
        fs.writeFileSync(outputPath, data.text);
        console.log('Text extracted successfully to:', outputPath);
        console.log('Text length:', data.text.length);
    } catch (error) {
        console.error('Error extracting PDF text from ' + pdfPath + ':', error);
    }
}

async function main() {
    await extractText(pdfPath1, '/tmp/autopsy1.txt');
    await extractText(pdfPath2, '/tmp/autopsy2.txt');
}

main();
