/**
 * Converts Json array into CSV
 * @param {Map[]} jsonArray : Array of json objects to convert to csv (rows)
 * @param {Map[]} headers   : Array of objects in the format { label: 'Example Label', fieldName: 'exampleFieldName' }
 */
const jsonToCSV = (jsonArray, headers) => {
  // specify how you want to handle null values here
  const replacer = (key, value) => (value === null ? "" : value);
  
  const csv = [
    headers.map( h => h.label ).join(","), // header row first
    ...jsonArray.map((row) =>
      headers
        .map((h) => JSON.stringify(row[h.fieldName], replacer))
        .join(",")
    )
  ].join("\r\n");
  return csv;
};

const downloadCSV = (csv,filename) => {
  // Creating anchor element to download
  let downloadElement = document.createElement('a');

  // This  encodeURI encodes special characters, except: , / ? : @ & = + $ # (Use encodeURIComponent() to encode these characters).
  downloadElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
  downloadElement.target = '_self';
  // CSV File Name
  downloadElement.download = filename;
  // below statement is required if you are using firefox browser
  document.body.appendChild(downloadElement);
  // click() Javascript function to download CSV file
  downloadElement.click(); 
}

export { jsonToCSV, downloadCSV };