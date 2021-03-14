import os
import nltk
import json
import enchant
import re
import traceback
from aiohttp import web
from dotenv import load_dotenv
from pathlib import Path


# load in port number
dotenv_path = Path("./.env")
load_dotenv(dotenv_path=dotenv_path)
port_number = os.getenv("PY_PORT")

# create app to listen for internal http requests
app = web.Application()

# globals for query filtering
MAX_QUERY_LEN = 50
enchant_dict = enchant.Dict("en_US")
stop_words_ls = nltk.corpus.stopwords.words("english")
additional_sw = [".", "'", "-"]  # catching the chars that are allowed 
for sw in additional_sw: stop_words_ls.append(sw)
stop_words = set(stop_words_ls)  
lemmatizer = nltk.stem.WordNetLemmatizer()


# desc.: given word, return true if it contains valid characters, false if not
def valid_word(word):
    # same regex pattern used to collect data
    valid = re.compile("[-a-zA-z0-9'\.\- ]")

    for char in word:
        if not re.match(valid, char):
            return False

    return True


# desc.: given text string, return list of valid/filtered words to be used in query
def word_filter(text):
    valid_words = []  # for valid words to return

    # break text str into set of unique words (not going to query duplicates or count them towards score twice)
    word_ls = set(nltk.word_tokenize(text))

    if len(word_ls) > MAX_QUERY_LEN:
        return [], "max_len"

    for word in word_ls:
        word = word.lower()  # all words everywhere will be lowercase, doing this before check because stopwords are lowercase
        # not stopword, only contains valid characters
        if word not in stop_words and valid_word(word):
            # update total word counter for the title, used for calculating frequency of each word
            word_lem = lemmatizer.lemmatize(word)  # all words everywhere will be lemmatized
            check = enchant_dict.check(word_lem)

            # case matters on proper nouns, this is kinda hacky, but whatever
            if not check:
                check = enchant_dict.check(word_lem.capitalize())

            # if true, this word is "valid"
            if check:
                valid_words.append(word_lem)

    return valid_words, "len_fine"


# main function 
async def filter_query(request):
    try:
        data = await request.json()
        query = data["unfilteredQuery"]
        print(f"received query: {query}")
        return_ls, return_msg = word_filter(query)
        return_obj = json.dumps({"filteredQueryArray": return_ls, "message": return_msg})
        print("returning: {}".format(return_obj))
        return web.Response(text=return_obj)
    except:
        return_obj = json.dumps({"filteredQueryArray": [], "message": "invalid"})
        print(traceback.format_exc())
        print("\n")
        return web.Response(text=return_obj)


# set up post route
app.router.add_post("/", filter_query)

if __name__ == "__main__":
    # run app
    web.run_app(app, port=port_number)

