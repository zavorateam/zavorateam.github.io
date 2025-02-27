function likelink(a, c, b) {
    xmlHttp = window.XMLHttpRequest ? new XMLHttpRequest : new ActiveXObject("Microsoft.XMLHTTP");
    xmlHttp.open("GET", c, !1);
    xmlHttp.send();
    c = xmlHttp.responseText;
    c = c.slice(c.lastIndexOf("BEGIN TUMBLR CODE"), c.lastIndexOf("END TUMBLR CODE"));
    vpid = c.substring(c.search("pid=") + 4, c.search("pid=") + 4 + c.substring(c.search("pid=") + 4).search("&"));
    vrk = c.substring(c.search("rk=") + 3, c.search("rk=") + 3 + c.substring(c.search("rk=") + 3).search("&"));
    document.getElementById(b + "likeimage" + a) && (document.getElementById(b + "likeimage" + a).setAttribute("src", "http://static.tumblr.com/uiqhh9x/Y36m6h0qu/liked.png"), document.getElementById(b + "like" + a).style.backgroundImage = "none");
    document.getElementById("notes" + a) && (c = parseInt(document.getElementById("notes" + a).innerHTML) + 1, document.getElementById("notes" + a).innerHTML = c);
    document.getElementById("likeimage" + a) && (document.getElementById("likeimage" + a).setAttribute("src", "http://static.tumblr.com/uiqhh9x/Y36m6h0qu/liked.png"), document.getElementById("like" + a).style.backgroundImage = "none");
    document.getElementById("likeiframe").setAttribute("src", "http://www.tumblr.com/like/" + vrk + "?id=" + vpid)

};