String.prototype.format = function() {
    var s = this,
        i = arguments.length;

    while (i--) {
		        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
		    }
    return s;
}

function getQuery(query) {
	var gifElem = ".load-gif-container";
	$(gifElem).show();

	var resultsContainer = ".all-results-container";
	$(resultsContainer).empty();

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
					</div>
					`.format(dataObj["cover_img_ref"]);

					/*
					var dataContainer = `
					<div class="result-container">
						<div class="data-left">
							<div class="img-container">
								<img src="{0}" class="cover-img"/>
							</div>
						</div>
						<div class="data-right">
							<div class="book-title">{1}</div>
							<div class="middle-data">
								<div class="book-author">{2}</div>
								<div class="book-description">{3}</div>
								<div class="fade-box"></div>
							</div>
						</div>
					</div>`.format(dataObj["cover_img_ref"], dataObj["unfiltered_title"], authorsStr, dataObj["description"], dataObj["amz_link"]);
					*/

					$(resultsContainer).append(dataContainer);
				}

				$(resultsContainer).append("<div class='contact'>Contact us bookbotapp@gmail.com</div>");
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

