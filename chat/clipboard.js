function fallbackCopyTextToClipboard(text, err, success) {
	var textArea = document.createElement("textarea");
	textArea.value = text;
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	try {
		var successful = document.execCommand('copy');
		
		if(!successful)
			err(text);
		else
			success(text);
	} catch (e) {
		err(text);
	}

	document.body.removeChild(textArea);
}

function copyTextToClipboard(text, err = function(){}, success = function(){}) {
	if (navigator.clipboard)
		navigator.clipboard.writeText(text).then(
			function () {success(text);},
			function () {err(text)}
		);
	else
		fallbackCopyTextToClipboard(text, err);
}

module.exports = copyTextToClipboard;