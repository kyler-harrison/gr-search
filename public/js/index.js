String.prototype.format = function() {
    var s = this,
        i = arguments.length;

    while (i--) {
		        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
		    }
    return s;
}

function getQuery(query) {
	var gifElem = ".load-gif";
	$(gifElem).show();

	var resultsContainer = ".all-results-container";
	$(resultsContainer).empty();

	var messageContainer = ".main-message-container";
	$(messageContainer).empty();

	if (query.length == 0) {
		query = "$random$";
	} 

	$.ajax({
		url: "https://www.bookbot.org/",
		type: "GET",
		data: {search: query},
		success: (result) => {
			$(gifElem).hide();

			var resStatus = result.resStatus;

			if (resStatus == "valid") {
				var dataArr = result.dataArr;
				for (var dataObj of dataArr) {
					var authorsStr = "";
					if (dataObj["authors"].length > 1) {
						authorsStr = dataObj["authors"].join(", ");
					} else {
						authorsStr = dataObj["authors"][0];
					}

					var dataContainer = ` 
					<div class="result-container">
						<img src="{0}" class="cover-img"/>
						<div class="text-container">
							<div class="text" style="font-weight: bold">{1}</div>
						</div>
						<div class="text-container">
							<div class="sub-text">{2}</div>
						</div>
						<div class="text-container book-desc">
							<div class="text">{3}</div>
						</div>
					</div>
					`.format(dataObj["cover_img_ref"], dataObj["unfiltered_title"], authorsStr, dataObj["description"]);

					$(resultsContainer).append(dataContainer);
				}

				$(resultsContainer).append("<div class='contact'>Contact us bookbotapp@gmail.com</div>");
			} else {
				var message = result.message;
				var returnMsgElem = "<div class='main-message-container'><p class='text'>" + message + "</p></div>";
				$(messageContainer).append(returnMsgElem);
			}
		} 
	});
}

$(document).on("keypress", (key) => {
	if (key.which == 13) {
		var input = $(".input-box").val();
		getQuery(input);
	}
});

$(".search-button").click(() => {
	var input = $(".input-box").val();
	getQuery(input);
});

